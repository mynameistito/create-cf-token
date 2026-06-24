/**
 * @module api/client
 *
 * Cloudflare REST API wrappers.
 */

import { Result, UnhandledException } from "better-result";

import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "@/errors/index.ts";
import { extractFailedPerm } from "@/permissions/group.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  TokenPolicy,
  UserInfo,
} from "@/types/index.ts";

const TRAILING_SLASH_REGEX = /\/+$/u;
const ACCOUNTS_PER_PAGE = 50;

/** Pagination metadata returned by Cloudflare list endpoints. */
interface CfResultInfo {
  count?: number;
  page?: number;
  per_page?: number;
  total_count?: number;
}

/** Cloudflare list response envelope including pagination metadata. */
interface CfListResponse<T> {
  success: boolean;
  result: T[];
  errors?: { message: string }[];
  result_info?: CfResultInfo;
}

/** Shape of a Cloudflare API v4 JSON envelope. */
interface CfApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: { message: string }[];
}

/**
 * Safely parse a JSON string, returning `null` on failure instead of throwing.
 *
 * @param text - Raw response body text.
 * @returns The parsed object cast to `T`, or `null` if parsing fails.
 */
function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Prefer structured Cloudflare `errors` messages; fall back to raw response text.
 *
 * @param text - Raw HTTP response body.
 * @param errors - Optional `errors` array from a Cloudflare API envelope.
 * @returns A single string suitable for error display.
 */
function formatApiErrorText(
  text: string,
  errors: { message?: string }[] | undefined
): string {
  const errorMessages =
    errors
      ?.map((error) => error.message)
      .filter((message): message is string => typeof message === "string") ??
    [];

  return errorMessages.length > 0 ? errorMessages.join("\n") : text;
}

/**
 * Parse a Cloudflare API response body and extract `result` on success.
 *
 * @param text - Raw HTTP response body.
 * @param path - Request path (included in thrown {@linkcode CloudflareApiError}).
 * @param res - Fetch `Response` (used for HTTP status when JSON parsing fails).
 * @returns The unwrapped `result` field from a successful envelope.
 * @throws {CloudflareApiError} When the body is not JSON or `success` is false.
 */
function parseCfResult<T>(text: string, path: string, res: Response): T {
  const json = tryParseJson<CfApiEnvelope<T>>(text);
  if (!json) {
    const message = res.ok
      ? "Invalid JSON response"
      : `HTTP ${res.status}: Invalid JSON response`;
    throw new CloudflareApiError({ messages: [message], path });
  }
  if (!json.success) {
    throw new CloudflareApiError({
      messages: (json.errors ?? []).map((e) => e.message),
      path,
    });
  }
  return json.result;
}

interface CloudflareErrorMessage {
  message?: string;
}

interface CreateTokenResponse {
  errors?: CloudflareErrorMessage[];
  result?: { id: string; value: string };
  success: boolean;
}

interface DeleteTokenResponse {
  errors?: { message?: string }[];
  result?: { id: string };
  success: boolean;
}

/** Resolve the Cloudflare API v4 base URL, honouring `CF_API_BASE_URL` when set. */
function cfApiBase(): string {
  const envVal = process.env.CF_API_BASE_URL;
  if (!envVal || envVal.trim() === "") {
    return "https://api.cloudflare.com/client/v4";
  }
  return envVal.trim().replace(TRAILING_SLASH_REGEX, "");
}

function authHeaders(apiToken: string) {
  return { Authorization: `Bearer ${apiToken}` };
}

/**
 * Authenticated GET against a Cloudflare API v4 path.
 *
 * @param path - Path appended to the API base (e.g. `/user`).
 * @param apiToken - Bearer token sent in the `Authorization` header.
 * @returns `Result<T, CloudflareApiError | UnhandledException>` with the parsed `result` on success.
 */
function cfGet<T>(
  path: string,
  apiToken: string
): Promise<Result<T, CloudflareApiError | UnhandledException>> {
  return Result.tryPromise({
    catch: (e) =>
      e instanceof CloudflareApiError
        ? e
        : new UnhandledException({ cause: e }),
    try: async () => {
      const res = await fetch(`${cfApiBase()}${path}`, {
        headers: authHeaders(apiToken),
      });
      const text = await res.text();
      return parseCfResult<T>(text, path, res);
    },
  });
}

/**
 * Fetch one page from a Cloudflare paginated list endpoint.
 *
 * @param basePath - List path without query string (e.g. `/accounts`).
 * @param apiToken - Bearer token sent in the `Authorization` header.
 * @param page - 1-based page number.
 * @param perPage - Items per page (`per_page` query param).
 * @returns The full list envelope including `result` and `result_info`.
 * @throws {CloudflareApiError} When the body is not JSON or `success` is false.
 */
async function fetchCfListPage<T>(
  basePath: string,
  apiToken: string,
  page: number,
  perPage: number
): Promise<CfListResponse<T>> {
  const path = `${basePath}?per_page=${perPage}&page=${page}`;
  const res = await fetch(`${cfApiBase()}${path}`, {
    headers: authHeaders(apiToken),
  });
  const text = await res.text();
  const json = tryParseJson<CfListResponse<T>>(text);
  if (!json) {
    const message = res.ok
      ? "Invalid JSON response"
      : `HTTP ${res.status}: Invalid JSON response`;
    throw new CloudflareApiError({ messages: [message], path });
  }
  if (!json.success) {
    throw new CloudflareApiError({
      messages: (json.errors ?? []).map((e) => e.message),
      path,
    });
  }
  return json;
}

/**
 * Determine whether pagination should stop after the current page.
 *
 * Stops on an empty page, when `total_count` is reached, or when fewer items
 * than `per_page` are returned.
 *
 * @param pageItems - Items from the page just fetched.
 * @param info - Optional `result_info` from the list envelope.
 * @param accumulatedCount - Total items collected so far (including this page).
 * @param perPage - Requested page size used when `result_info.per_page` is absent.
 * @returns `true` when no further pages should be fetched.
 */
function isLastCfListPage<T>(
  pageItems: T[],
  info: CfResultInfo | undefined,
  accumulatedCount: number,
  perPage: number
): boolean {
  if (pageItems.length === 0) {
    return true;
  }
  if (info?.total_count !== undefined && accumulatedCount >= info.total_count) {
    return true;
  }
  const pageSize = info?.per_page ?? perPage;
  return pageItems.length < pageSize;
}

/**
 * Recursively fetch all pages from a Cloudflare paginated list endpoint.
 *
 * @param basePath - List path without query string.
 * @param apiToken - Bearer token sent in the `Authorization` header.
 * @param page - Current 1-based page number.
 * @param perPage - Items per page.
 * @param accumulated - Items collected from prior pages.
 * @returns Concatenated `result` arrays from every page.
 */
async function fetchCfListPages<T>(
  basePath: string,
  apiToken: string,
  page: number,
  perPage: number,
  accumulated: T[]
): Promise<T[]> {
  const json = await fetchCfListPage<T>(basePath, apiToken, page, perPage);
  const pageItems = json.result;
  const next = [...accumulated, ...pageItems];

  if (isLastCfListPage(pageItems, json.result_info, next.length, perPage)) {
    return next;
  }

  return fetchCfListPages(basePath, apiToken, page + 1, perPage, next);
}

/**
 * Authenticated GET for paginated list endpoints; fetches every page and concatenates `result` arrays.
 *
 * @param basePath - List path without query string.
 * @param apiToken - Bearer token sent in the `Authorization` header.
 * @param perPage - Items per page (defaults to 50).
 * @returns `Result<T[], CloudflareApiError | UnhandledException>` with all items on success.
 */
function cfGetPaginatedList<T>(
  basePath: string,
  apiToken: string,
  perPage = ACCOUNTS_PER_PAGE
): Promise<Result<T[], CloudflareApiError | UnhandledException>> {
  return Result.tryPromise({
    catch: (e) =>
      e instanceof CloudflareApiError
        ? e
        : new UnhandledException({ cause: e }),
    try: () => fetchCfListPages<T>(basePath, apiToken, 1, perPage, []),
  });
}

/**
 * Fetch the authenticated user's profile (`GET /user`).
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<UserInfo, CloudflareApiError | UnhandledException>`.
 */
export function getUser(
  apiToken: string
): Promise<Result<UserInfo, CloudflareApiError | UnhandledException>> {
  return cfGet<UserInfo>("/user", apiToken);
}

/**
 * Fetch all accounts the authenticated user has access to (`GET /accounts`).
 *
 * Paginates through the Cloudflare API until every page is retrieved.
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<Account[], CloudflareApiError | UnhandledException>`.
 */
export function getAccounts(
  apiToken: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGetPaginatedList<Account>("/accounts", apiToken);
}

/**
 * Fetch all assignable permission groups for API tokens (`GET /user/tokens/permission_groups`).
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<PermissionGroup[], CloudflareApiError | UnhandledException>`.
 */
export function getPermissionGroups(
  apiToken: string
): Promise<Result<PermissionGroup[], CloudflareApiError | UnhandledException>> {
  return cfGet<PermissionGroup[]>("/user/tokens/permission_groups", apiToken);
}

/**
 * Create a new Cloudflare user API token (`POST /user/tokens`).
 *
 * Maps restricted-permission API errors to {@linkcode RestrictedPermissionError}
 * so callers can retry with exclusions.
 *
 * @param apiToken - Scoped token with `User API Tokens:Edit` permission.
 * @param name - Display name for the new token.
 * @param policies - Permission policies to attach to the token.
 * @returns `Result<CreatedToken, RestrictedPermissionError | TokenCreationError | UnhandledException>`.
 */
export function createToken(
  apiToken: string,
  name: string,
  policies: TokenPolicy[]
): Promise<
  Result<
    CreatedToken,
    RestrictedPermissionError | TokenCreationError | UnhandledException
  >
> {
  return Result.tryPromise({
    catch: (e) => {
      if (
        e instanceof RestrictedPermissionError ||
        e instanceof TokenCreationError
      ) {
        return e;
      }
      return new UnhandledException({ cause: e });
    },
    try: async () => {
      const path = "/user/tokens";
      const res = await fetch(`${cfApiBase()}${path}`, {
        body: JSON.stringify({ name, policies }),
        headers: {
          ...authHeaders(apiToken),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const text = await res.text();
      const json = tryParseJson<CreateTokenResponse>(text);
      if (res.ok && json?.success && json.result) {
        return {
          id: json.result.id,
          name,
          value: json.result.value,
        };
      }

      const errorMessages =
        json?.errors
          ?.map((error) => error.message)
          .filter(
            (message): message is string => typeof message === "string"
          ) ?? [];

      const failedPerm = extractFailedPerm([...errorMessages, text]);
      if (failedPerm) {
        throw new RestrictedPermissionError({
          errorText: text,
          permissionName: failedPerm,
        });
      }

      throw new TokenCreationError({
        errorText: formatApiErrorText(text, json?.errors),
      });
    },
  });
}

/**
 * Delete (revoke) a Cloudflare user API token by ID (`DELETE /user/tokens/:id`).
 *
 * @param tokenId - The unique identifier of the token to delete.
 * @param apiToken - Scoped Cloudflare API token with permission to manage tokens.
 * @returns `Result<string, TokenDeletionError | UnhandledException>` — the deleted token's ID on success.
 */
export function deleteToken(
  tokenId: string,
  apiToken: string
): Promise<Result<string, TokenDeletionError | UnhandledException>> {
  return Result.tryPromise({
    catch: (e) =>
      e instanceof TokenDeletionError
        ? e
        : new UnhandledException({ cause: e }),
    try: async () => {
      const res = await fetch(`${cfApiBase()}/user/tokens/${tokenId}`, {
        headers: authHeaders(apiToken),
        method: "DELETE",
      });
      const text = await res.text();
      const json = tryParseJson<DeleteTokenResponse>(text);

      if (res.ok && json?.success) {
        return json.result?.id ?? tokenId;
      }

      throw new TokenDeletionError({
        errorText: formatApiErrorText(text, json?.errors),
      });
    },
  });
}
