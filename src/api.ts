import { Result, UnhandledException } from "better-result";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
} from "./errors.ts";
import { extractFailedPerm } from "./permissions.ts";
import type { Account, PermissionGroup, Policy, UserInfo } from "./types.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

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
      const res = await fetch(`${CF_API}${path}`, {
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
    string,
    RestrictedPermissionError | TokenCreationError | UnhandledException
  >
> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`${CF_API}/user/tokens`, {
        method: "POST",
        headers: {
          ...authHeaders(email, apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, policies }),
      });
      const text = await res.text();
      const json = JSON.parse(text) as {
        success: boolean;
        result: { value: string };
      };
      if (res.ok && json.success) {
        return json.result.value;
      }

      const failedPerm = extractFailedPerm(text);
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
