import { Result, UnhandledException } from "better-result";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "#src/errors.ts";
import { extractFailedPerm } from "#src/permissions.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  Policy,
  UserInfo,
} from "#src/types.ts";

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

/** Shape of a single error object inside a Cloudflare API response. */
interface CloudflareErrorMessage {
  message?: string;
}

/** Shape of the raw response from `POST /user/tokens`. */
interface CreateTokenResponse {
  errors?: CloudflareErrorMessage[];
  result?: { id: string; value: string };
  success: boolean;
}

/** Shape of the raw response from `DELETE /user/tokens/:id`. */
interface DeleteTokenResponse {
  result?: { id: string };
  success: boolean;
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
 * Build the authentication headers required by the Cloudflare API.
 *
 * @param email - The user's Cloudflare account email.
 * @param apiKey - The user's Global API Key.
 * @returns Headers object with `X-Auth-Email` and `X-Auth-Key`.
 */
function authHeaders(email: string, apiKey: string) {
  return { "X-Auth-Email": email, "X-Auth-Key": apiKey };
}

/**
 * Internal helper for authenticated GET requests against the Cloudflare API.
 * Parses the response, checks `success`, and extracts `result`.
 *
 * @typeParam T - Expected shape of the `result` field.
 * @param path - API path (e.g. `"/user"` or `"/accounts?per_page=50"`).
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns A `Result<T, CloudflareApiError | UnhandledException>`.
 */
function cfGet<T>(
  path: string,
  email: string,
  apiKey: string
): Promise<Result<T, CloudflareApiError | UnhandledException>> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`${cfApiBase()}${path}`, {
        headers: authHeaders(email, apiKey),
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
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns `Result<UserInfo, CloudflareApiError | UnhandledException>`
 */
export function getUser(
  email: string,
  apiKey: string
): Promise<Result<UserInfo, CloudflareApiError | UnhandledException>> {
  return cfGet<UserInfo>("/user", email, apiKey);
}

/**
 * Fetch all accounts the authenticated user has access to (up to 50).
 *
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns `Result<Account[], CloudflareApiError | UnhandledException>`
 */
export function getAccounts(
  email: string,
  apiKey: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGet<Account[]>("/accounts?per_page=50", email, apiKey);
}

/**
 * Fetch all available permission groups for API tokens.
 *
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns `Result<PermissionGroup[], CloudflareApiError | UnhandledException>`
 */
export function getPermissionGroups(
  email: string,
  apiKey: string
): Promise<Result<PermissionGroup[], CloudflareApiError | UnhandledException>> {
  return cfGet<PermissionGroup[]>(
    "/user/tokens/permission_groups",
    email,
    apiKey
  );
}

/**
 * Create a new Cloudflare API token with the given name and policies.
 *
 * If the API rejects a specific permission group as restricted, returns a
 * {@linkcode RestrictedPermissionError} so the caller can exclude it and retry.
 * For all other failures, returns a {@linkcode TokenCreationError}.
 *
 * @param name - Human-readable token name.
 * @param policies - Array of {@linkcode Policy} objects defining permissions.
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns `Result<CreatedToken, RestrictedPermissionError | TokenCreationError | UnhandledException>`
 */
export function createToken(
  name: string,
  policies: Policy[],
  email: string,
  apiKey: string
): Promise<
  Result<
    CreatedToken,
    RestrictedPermissionError | TokenCreationError | UnhandledException
  >
> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`${cfApiBase()}/user/tokens`, {
        method: "POST",
        headers: {
          ...authHeaders(email, apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, policies }),
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
          permissionName: failedPerm,
          errorText: text,
        });
      }

      throw new TokenCreationError({ errorText: text });
    },
    catch: (e) => {
      if (
        e instanceof RestrictedPermissionError ||
        e instanceof TokenCreationError
      ) {
        return e;
      }
      return new UnhandledException({ cause: e });
    },
  });
}

/**
 * Delete (revoke) a Cloudflare API token by its ID.
 *
 * @param tokenId - The unique identifier of the token to delete.
 * @param email - Cloudflare account email.
 * @param apiKey - Global API Key.
 * @returns `Result<string, TokenDeletionError | UnhandledException>` — the deleted token's ID on success.
 */
export function deleteToken(
  tokenId: string,
  email: string,
  apiKey: string
): Promise<Result<string, TokenDeletionError | UnhandledException>> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`${cfApiBase()}/user/tokens/${tokenId}`, {
        method: "DELETE",
        headers: authHeaders(email, apiKey),
      });
      const text = await res.text();
      const json = tryParseJson<DeleteTokenResponse>(text);

      if (res.ok && json?.success) {
        return json.result?.id ?? tokenId;
      }

      throw new TokenDeletionError({ errorText: text });
    },
    catch: (e) =>
      e instanceof TokenDeletionError
        ? e
        : new UnhandledException({ cause: e }),
  });
}
