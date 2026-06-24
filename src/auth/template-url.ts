import type { PermissionGroup } from "@/types/index.ts";

/** URL to the Cloudflare dashboard API tokens page, shown in prompts and errors. */
export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

/**
 * Build a dashboard "Create Token" template URL from permission group keys.
 *
 * @param keys - Permission group keys and action types for the template query string.
 * @returns A fully-formed dashboard URL with pre-filled template parameters.
 */
function buildAuthTemplateUrlFromKeys(
  keys: { key: string; type: string }[]
): string {
  const params = new URLSearchParams({
    accountId: "*",
    name: "create-cf-token",
    permissionGroupKeys: JSON.stringify(keys),
    zoneId: "all",
  });
  return `${CF_API_TOKENS_URL}?${params.toString()}`;
}

/**
 * Pre-built template URL to create the scoped auth token required by this tool.
 *
 * Keys are best-effort fallbacks — use {@linkcode buildAuthTemplateUrl} post-auth for accurate keys.
 */
export const CF_AUTH_TEMPLATE_URL = buildAuthTemplateUrlFromKeys([
  { key: "user_details", type: "read" },
  { key: "api_tokens", type: "edit" },
  { key: "account_settings", type: "read" },
]);

const USER_SCOPE = "com.cloudflare.api.user";
const ACCOUNT_SCOPE = "com.cloudflare.api.account";
const toLower = (s: string): string => s.toLowerCase();
const hasKey = (permission: PermissionGroup): boolean => !!permission.key;

/**
 * Find a permission group by stable key, action suffix, and Cloudflare scope.
 *
 * Matches names ending in "read" for read actions, or "edit"/"write" for edit actions.
 *
 * @param perms - Permission groups from `/user/tokens/permission_groups`.
 * @param permissionKey - Stable permission key (e.g. `user_details`, `api_tokens`).
 * @param action - Required action level.
 * @param scope - Cloudflare scope string (user or account).
 * @returns The matching permission group, or `undefined` if none match.
 */
function findPermissionByKey(
  perms: PermissionGroup[],
  permissionKey: string,
  action: "read" | "edit",
  scope: string
): PermissionGroup | undefined {
  return perms.find((permission) => {
    if (
      !hasKey(permission) ||
      permission.key !== permissionKey ||
      !permission.scopes.includes(scope)
    ) {
      return false;
    }

    const normalizedName = toLower(permission.name);
    if (action === "read") {
      return normalizedName.endsWith("read");
    }

    return normalizedName.endsWith("edit") || normalizedName.endsWith("write");
  });
}

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
  const detailsRead = findPermissionByKey(
    perms,
    "user_details",
    "read",
    USER_SCOPE
  );

  const tokensEdit = findPermissionByKey(
    perms,
    "api_tokens",
    "edit",
    USER_SCOPE
  );

  const accountRead = findPermissionByKey(
    perms,
    "account_settings",
    "read",
    ACCOUNT_SCOPE
  );

  if (!(detailsRead?.key && tokensEdit?.key && accountRead?.key)) {
    return;
  }

  return buildAuthTemplateUrlFromKeys([
    { key: detailsRead.key, type: "read" },
    { key: tokensEdit.key, type: "edit" },
    { key: accountRead.key, type: "read" },
  ]);
}
