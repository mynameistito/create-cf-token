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
  TokenPolicy,
  UserInfo,
} from "#src/types.ts";

const TRAILING_SLASH_REGEX = /\/+$/u;

interface CloudflareErrorMessage {
  message?: string;
}

interface CreateTokenResponse {
  errors?: CloudflareErrorMessage[];
  result?: { id: string; value: string };
  success: boolean;
}

interface DeleteTokenResponse {
  result?: { id: string };
  success: boolean;
}

function cfApiBase(): string {
  const envVal = process.env.CF_API_BASE_URL;
  if (!envVal || envVal.trim() === "") {
    return "https://api.cloudflare.com/client/v4";
  }
  return envVal.trim().replace(TRAILING_SLASH_REGEX, "");
}

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function authHeaders(apiToken: string) {
  return { Authorization: `Bearer ${apiToken}` };
}

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

export function getUser(
  apiToken: string
): Promise<Result<UserInfo, CloudflareApiError | UnhandledException>> {
  return cfGet<UserInfo>("/user", apiToken);
}

export function getAccounts(
  apiToken: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGet<Account[]>("/accounts?per_page=50", apiToken);
}

export function getPermissionGroups(
  apiToken: string
): Promise<Result<PermissionGroup[], CloudflareApiError | UnhandledException>> {
  return cfGet<PermissionGroup[]>("/user/tokens/permission_groups", apiToken);
}

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
      const res = await fetch(`${cfApiBase()}/user/tokens`, {
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

      throw new TokenCreationError({ errorText: text });
    },
  });
}

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

      throw new TokenDeletionError({ errorText: text });
    },
  });
}
