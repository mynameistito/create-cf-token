import { Result, UnhandledException } from "better-result";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "./errors.ts";
import { extractFailedPerm } from "./permissions.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  Policy,
  UserInfo,
} from "./types.ts";

const TRAILING_SLASH_REGEX = /\/+$/;

function cfApiBase(): string {
  const envVal = process.env.CF_API_BASE_URL;
  if (!envVal || envVal.trim() === "") {
    return "https://api.cloudflare.com/client/v4";
  }
  return envVal.trim().replace(TRAILING_SLASH_REGEX, "");
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
  result?: { id: string };
  success: boolean;
}

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function authHeaders(email: string, apiKey: string) {
  return { "X-Auth-Email": email, "X-Auth-Key": apiKey };
}

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

export function getUser(
  email: string,
  apiKey: string
): Promise<Result<UserInfo, CloudflareApiError | UnhandledException>> {
  return cfGet<UserInfo>("/user", email, apiKey);
}

export function getAccounts(
  email: string,
  apiKey: string
): Promise<Result<Account[], CloudflareApiError | UnhandledException>> {
  return cfGet<Account[]>("/accounts?per_page=50", email, apiKey);
}

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
