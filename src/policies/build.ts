/**
 * @module policies/build
 *
 * Cloudflare API token policy construction from permission selections.
 */

import { isPermissionExcluded } from "@/permissions/group.ts";
import type { Account, PermissionGroup, TokenPolicy } from "@/types/index.ts";

export function buildPolicies(
  perms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  excluded: Set<string> = new Set<string>()
): TokenPolicy[] {
  const USER_SCOPE = "com.cloudflare.api.user";
  const ZONE_SCOPE = "com.cloudflare.api.account.zone";
  const ACCOUNT_SCOPE = "com.cloudflare.api.account";

  const filteredPerms = perms.filter(
    (p) => !isPermissionExcluded(p.name, excluded)
  );
  const userPerms = filteredPerms.filter((p) => p.scopes.includes(USER_SCOPE));
  const zonePerms = filteredPerms.filter(
    (p) => !p.scopes.includes(USER_SCOPE) && p.scopes.includes(ZONE_SCOPE)
  );
  const accountPerms = filteredPerms.filter(
    (p) =>
      p.scopes.includes(ACCOUNT_SCOPE) &&
      !p.scopes.includes(USER_SCOPE) &&
      !p.scopes.includes(ZONE_SCOPE)
  );

  const policies: TokenPolicy[] = [];

  if (userPerms.length > 0) {
    policies.push({
      effect: "allow",
      permission_groups: userPerms.map((p) => ({ id: p.id })),
      resources: { [`com.cloudflare.api.user.${userId}`]: "*" },
    });
  }

  if (zonePerms.length > 0 && accounts.length > 0) {
    const zoneResources: Record<string, Record<string, "*">> = {};
    for (const acct of accounts) {
      zoneResources[`com.cloudflare.api.account.${acct.id}`] = {
        "com.cloudflare.api.account.zone.*": "*",
      };
    }
    policies.push({
      effect: "allow",
      permission_groups: zonePerms.map((p) => ({ id: p.id })),
      resources: zoneResources,
    });
  }

  if (accountPerms.length > 0 && accounts.length > 0) {
    const accountResources: Record<string, "*"> = {};
    for (const acct of accounts) {
      accountResources[`com.cloudflare.api.account.${acct.id}`] = "*";
    }
    policies.push({
      effect: "allow",
      permission_groups: accountPerms.map((p) => ({ id: p.id })),
      resources: accountResources,
    });
  }

  return policies;
}
