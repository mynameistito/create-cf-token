import type { PermissionGroup } from "#src/types/index.ts";

/** URL to the Cloudflare dashboard API tokens page, shown in prompts and errors. */
export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

/** Pre-built template URL to create the scoped auth token required by this tool.
 *  Keys are best-effort fallbacks — use {@linkcode buildAuthTemplateUrl} post-auth for accurate keys. */
export const CF_AUTH_TEMPLATE_URL = (() => {
  const keys = [
    { key: "user_details", type: "read" },
    { key: "api_tokens", type: "edit" },
    { key: "account_settings", type: "read" },
  ];
  const params = new URLSearchParams({
    accountId: "*",
    name: "create-cf-token",
    permissionGroupKeys: JSON.stringify(keys),
    zoneId: "all",
  });
  return `${CF_API_TOKENS_URL}?${params.toString()}`;
})();

const USER_SCOPE = "com.cloudflare.api.user";
const ACCOUNT_SCOPE = "com.cloudflare.api.account";
const toLower = (s: string): string => s.toLowerCase();
const hasKey = (permission: PermissionGroup): boolean => !!permission.key;

/**
 * Build the auth token template URL dynamically from the live permission groups API response.
 * Looks up the real `key` values for the three required permissions: User Details:Read,
 * User API Tokens:Edit, and Account Settings:Read (needed to list accounts).
 *
 * @param perms - Permission groups fetched from `/user/tokens/permission_groups`.
 * @returns A fully-formed template URL, or `undefined` if the required keys are missing.
 */
export function buildAuthTemplateUrl(
  perms: PermissionGroup[]
): string | undefined {
  const detailsRead = perms.find(
    (p) =>
      hasKey(p) &&
      p.scopes.includes(USER_SCOPE) &&
      toLower(p.name).includes("user details") &&
      toLower(p.name).endsWith("read")
  );

  const tokensEdit = perms.find(
    (p) =>
      hasKey(p) &&
      p.scopes.includes(USER_SCOPE) &&
      toLower(p.name).includes("token") &&
      (toLower(p.name).endsWith("edit") || toLower(p.name).endsWith("write"))
  );

  const accountRead = perms.find(
    (p) =>
      hasKey(p) &&
      p.scopes.includes(ACCOUNT_SCOPE) &&
      toLower(p.name).includes("account") &&
      toLower(p.name).includes("settings") &&
      toLower(p.name).endsWith("read")
  );

  if (!(detailsRead?.key && tokensEdit?.key && accountRead?.key)) {
    return;
  }

  const keys = [
    { key: detailsRead.key, type: "read" },
    { key: tokensEdit.key, type: "edit" },
    { key: accountRead.key, type: "read" },
  ];
  const params = new URLSearchParams({
    accountId: "*",
    name: "create-cf-token",
    permissionGroupKeys: JSON.stringify(keys),
    zoneId: "all",
  });
  return `${CF_API_TOKENS_URL}?${params.toString()}`;
}
