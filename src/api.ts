import { Result, UnhandledException } from "better-result";
import { CloudflareApiError } from "#src/errors.ts";
import type { Account, CreatedToken, PermissionGroup, TokenPolicy, UserInfo } from "#src/types.ts";

const TRAILING_SLASH_REGEX = /\/+$/;

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
 * @typeParam T - Expected shape of the `result` field.
 * @param path - API path (e.g. `"/user"` or `"/accounts?per_page=50"`).
 * @param apiToken - Scoped Cloudflare API token.
 * @returns A `Result<T, CloudflareApiError | UnhandledException>`.
 */
function cfGet<T>(
  path: string,
  apiToken: string
): Promise<Result<T, CloudflareApiError | UnhandledException>> {
  return Result.tryPromise({
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
          path,
          messages: json.errors.map((e) => e.message),
        });
      }
      return json.result;
    },
    catch: (e) =>
      e instanceof CloudflareApiError
        ? e
        : new UnhandledException({ cause: e }),
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
 * @typeParam T - Expected shape of the `result` field.
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
    try: async () => {
      const res = await fetch(`${cfApiBase()}${path}`, {
        method: "POST",
        headers: { ...authHeaders(apiToken), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success: boolean;
        result: T;
        errors: { message: string }[];
      };
      if (!json.success) {
        throw new CloudflareApiError({
          path,
          messages: json.errors.map((e) => e.message),
        });
      }
      return json.result;
    },
    catch: (e) =>
      e instanceof CloudflareApiError
        ? e
        : new UnhandledException({ cause: e }),
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
