import { Result, UnhandledException } from "better-result";

import { CloudflareApiError } from "#src/errors.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  TokenPolicy,
  UserInfo,
} from "#src/types.ts";

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
  errors: { message: string }[];
  result_info?: CfResultInfo;
}

/**
 * Resolve the Cloudflare API base URL.
 * Reads `CF_API_BASE_URL` from the environment; falls back to the public API.
 * Strips any trailing slashes to avoid double-slash path construction.
 */
function cfApiBase(): string {
  const envVal = process.env.CF_API_BASE_URL;
  if (!envVal || envVal.trim() === "") {
    return "https://api.cloudflare.com/client/v4";
  }
  return envVal.trim().replace(TRAILING_SLASH_REGEX, "");
}

/**
 * Build the authentication headers required by the Cloudflare API.
 *
 * @param apiToken - A scoped Cloudflare API token.
 * @returns Headers object with `Authorization: Bearer <token>`.
 */
function authHeaders(apiToken: string) {
  return { Authorization: `Bearer ${apiToken}` };
}

/**
 * Internal helper for authenticated GET requests against the Cloudflare API.
 * Parses the response, checks `success`, and extracts `result`.
 *
 * @template T - Expected shape of the `result` field.
 * @param path - API path (e.g. `"/user"` or `"/accounts?per_page=50"`).
 * @param apiToken - Scoped Cloudflare API token.
 * @returns A `Result<T, CloudflareApiError | UnhandledException>`.
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
      const json = (await res.json()) as {
        success: boolean;
        result: T;
        errors: { message: string }[];
      };
      if (!json.success) {
        throw new CloudflareApiError({
          messages: json.errors.map((e) => e.message),
          path,
        });
      }
      return json.result;
    },
  });
}

/**
 * Fetch one page from a Cloudflare paginated list endpoint.
 *
 * @throws {CloudflareApiError} When the API returns `success: false`.
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
  const json = (await res.json()) as CfListResponse<T>;
  if (!json.success) {
    throw new CloudflareApiError({
      messages: json.errors.map((e) => e.message),
      path,
    });
  }
  return json;
}

/**
 * Determine whether pagination should stop after the current page.
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
 * Recursively fetch remaining pages from a Cloudflare paginated list endpoint.
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
 * Internal helper for paginated GET list endpoints.
 * Fetches every page and concatenates `result` arrays.
 *
 * @template T - Item type within the paginated `result` array.
 * @param basePath - API path without query string (e.g. `"/accounts"`).
 * @param apiToken - Scoped Cloudflare API token.
 * @param perPage - Page size passed as `per_page` (default 50).
 * @returns A `Result<T[], CloudflareApiError | UnhandledException>`.
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
 * Fetch the authenticated user's profile.
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<UserInfo, CloudflareApiError | UnhandledException>`
 */
export function getUser(
  apiToken: string
): Promise<Result<UserInfo, CloudflareApiError | UnhandledException>> {
  return cfGet<UserInfo>("/user", apiToken);
}

/**
 * Fetch all accounts the authenticated user has access to.
 * Paginates through the Cloudflare API until every page is retrieved.
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<Account[], CloudflareApiError | UnhandledException>`
 */
export function getAccounts(
  apiToken: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGetPaginatedList<Account>("/accounts", apiToken);
}

/**
 * Fetch all available permission groups for API tokens.
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<PermissionGroup[], CloudflareApiError | UnhandledException>`
 */
export function getPermissionGroups(
  apiToken: string
): Promise<Result<PermissionGroup[], CloudflareApiError | UnhandledException>> {
  return cfGet<PermissionGroup[]>("/user/tokens/permission_groups", apiToken);
}

/**
 * Internal helper for authenticated POST requests against the Cloudflare API.
 *
 * @template T - Expected shape of the `result` field.
 * @param path - API path (e.g. `"/user/tokens"`).
 * @param apiToken - Scoped Cloudflare API token.
 * @param body - Request body (will be JSON-serialised).
 * @returns A `Result<T, CloudflareApiError | UnhandledException>`.
 */
function cfPost<T>(
  path: string,
  apiToken: string,
  body: unknown
): Promise<Result<T, CloudflareApiError | UnhandledException>> {
  return Result.tryPromise({
    catch: (e) =>
      e instanceof CloudflareApiError
        ? e
        : new UnhandledException({ cause: e }),
    try: async () => {
      const res = await fetch(`${cfApiBase()}${path}`, {
        body: JSON.stringify(body),
        headers: {
          ...authHeaders(apiToken),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const json = (await res.json()) as {
        success: boolean;
        result: T;
        errors: { message: string }[];
      };
      if (!json.success) {
        throw new CloudflareApiError({
          messages: json.errors.map((e) => e.message),
          path,
        });
      }
      return json.result;
    },
  });
}

/**
 * Create a new Cloudflare user API token.
 *
 * @param apiToken - Scoped token with `User API Tokens:Edit` permission.
 * @param name - Display name for the new token.
 * @param policies - Permission policies to attach to the token.
 * @returns `Result<CreatedToken, CloudflareApiError | UnhandledException>`.
 *   The `value` field contains the token secret and is only present on creation.
 */
export function createToken(
  apiToken: string,
  name: string,
  policies: TokenPolicy[]
): Promise<Result<CreatedToken, CloudflareApiError | UnhandledException>> {
  return cfPost<CreatedToken>("/user/tokens", apiToken, { name, policies });
}
