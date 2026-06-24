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
 * Parse a Cloudflare API response body and extract `result` on success.
 *
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
      const text = await res.text();
      return parseCfResult<T>(text, path, res);
    },
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
 * Fetch all accounts the authenticated user has access to (up to 50).
 *
 * @param apiToken - Scoped Cloudflare API token.
 * @returns `Result<Account[], CloudflareApiError | UnhandledException>`
 */
export function getAccounts(
  apiToken: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGet<Account[]>("/accounts?per_page=50", apiToken);
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
      const text = await res.text();
      return parseCfResult<T>(text, path, res);
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
