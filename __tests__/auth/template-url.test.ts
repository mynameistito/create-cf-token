import { describe, expect, test } from "bun:test";

import {
  buildAuthTemplateUrl,
  CF_API_TOKENS_URL,
  CF_AUTH_TEMPLATE_URL,
} from "#src/auth/template-url.ts";
import type { PermissionGroup } from "#src/types/index.ts";

const USER_SCOPE = "com.cloudflare.api.user";
const ACCOUNT_SCOPE = "com.cloudflare.api.account";

const requiredPerms: PermissionGroup[] = [
  {
    description: "Read user details",
    id: "user-details-read",
    key: "user_details",
    name: "User Details Read",
    scopes: [USER_SCOPE],
  },
  {
    description: "Edit API tokens",
    id: "api-tokens-edit",
    key: "api_tokens",
    name: "User API Tokens Edit",
    scopes: [USER_SCOPE],
  },
  {
    description: "Read account settings",
    id: "account-settings-read",
    key: "account_settings",
    name: "Account Settings Read",
    scopes: [ACCOUNT_SCOPE],
  },
];

describe("buildAuthTemplateUrl", () => {
  test("returns URL with correct keys when matching perms provided", () => {
    const url = buildAuthTemplateUrl(requiredPerms);
    expect(url).toBeDefined();

    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe(CF_API_TOKENS_URL);
    expect(parsed.searchParams.get("accountId")).toBe("*");
    expect(parsed.searchParams.get("name")).toBe("create-cf-token");
    expect(parsed.searchParams.get("zoneId")).toBe("all");

    const keys = JSON.parse(
      parsed.searchParams.get("permissionGroupKeys") ?? "[]"
    ) as { key: string; type: string }[];

    expect(keys).toEqual([
      { key: "user_details", type: "read" },
      { key: "api_tokens", type: "edit" },
      { key: "account_settings", type: "read" },
    ]);
  });

  test("returns undefined when required perms missing", () => {
    expect(buildAuthTemplateUrl([])).toBeUndefined();
    expect(
      buildAuthTemplateUrl([
        {
          description: "Read user details",
          id: "user-details-read",
          key: "user_details",
          name: "User Details Read",
          scopes: [USER_SCOPE],
        },
      ])
    ).toBeUndefined();
    expect(
      buildAuthTemplateUrl(
        requiredPerms.map((perm) =>
          perm.name === "Account Settings Read"
            ? { ...perm, key: undefined }
            : perm
        )
      )
    ).toBeUndefined();
  });
});

describe("auth template URL constants", () => {
  test("CF_AUTH_TEMPLATE_URL and CF_API_TOKENS_URL are valid URLs", () => {
    expect(() => new URL(CF_API_TOKENS_URL)).not.toThrow();
    expect(() => new URL(CF_AUTH_TEMPLATE_URL)).not.toThrow();

    const authUrl = new URL(CF_AUTH_TEMPLATE_URL);
    expect(authUrl.origin + authUrl.pathname).toBe(CF_API_TOKENS_URL);
    expect(authUrl.searchParams.get("name")).toBe("create-cf-token");
    expect(authUrl.searchParams.get("permissionGroupKeys")).toBeTruthy();
  });
});
