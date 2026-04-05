import { describe, expect, test } from "bun:test";
import { buildPolicies } from "#src/index.ts";
import type { PermissionGroup } from "#src/types.ts";

function makePerm(id: string, name: string, scopes: string[]): PermissionGroup {
  return { id, name, description: "", scopes };
}

const USER_RESOURCES = { "com.cloudflare.api.user.u1": "*" };
const ACCOUNT_RESOURCES = { "com.cloudflare.api.account.a1": "*" };

describe("buildPolicies", () => {
  test.concurrent("returns empty array when all perms are excluded", () => {
    const perm = makePerm("p1", "DNS Read", ["com.cloudflare.api.user"]);
    const result = buildPolicies(
      [perm],
      [],
      [],
      new Set(["DNS Read"]),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toEqual([]);
  });

  test.concurrent("creates a user policy for user-scoped perms", () => {
    const perm = makePerm("p1", "DNS Read", ["com.cloudflare.api.user"]);
    const result = buildPolicies(
      [perm],
      [],
      [],
      new Set(),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.effect).toBe("allow");
    expect(result[0]?.resources).toEqual(USER_RESOURCES);
    expect(result[0]?.permission_groups).toEqual([{ id: "p1" }]);
  });

  test.concurrent("creates an account policy for account-scoped perms", () => {
    const perm = makePerm("p2", "Workers Read", ["com.cloudflare.api.account"]);
    const result = buildPolicies(
      [],
      [perm],
      [],
      new Set(),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.resources).toEqual(ACCOUNT_RESOURCES);
    expect(result[0]?.permission_groups).toEqual([{ id: "p2" }]);
  });

  test.concurrent("creates an account-resources policy for zone-scoped perms", () => {
    const perm = makePerm("p3", "DNS Write", [
      "com.cloudflare.api.account.zone",
    ]);
    const result = buildPolicies(
      [],
      [],
      [perm],
      new Set(),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.resources).toEqual(ACCOUNT_RESOURCES);
    expect(result[0]?.permission_groups).toEqual([{ id: "p3" }]);
  });

  test.concurrent("returns three policies for user + account + zone perms", () => {
    const userPerm = makePerm("u1", "User Read", ["com.cloudflare.api.user"]);
    const acctPerm = makePerm("a1", "Workers Read", [
      "com.cloudflare.api.account",
    ]);
    const zonePerm = makePerm("z1", "DNS Write", [
      "com.cloudflare.api.account.zone",
    ]);
    const result = buildPolicies(
      [userPerm],
      [acctPerm],
      [zonePerm],
      new Set(),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(3);
  });

  test.concurrent("excludes perms in the excluded set", () => {
    const p1 = makePerm("p1", "DNS Read", ["com.cloudflare.api.user"]);
    const p2 = makePerm("p2", "API Tokens", ["com.cloudflare.api.user"]);
    const result = buildPolicies(
      [p1, p2],
      [],
      [],
      new Set(["API Tokens"]),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.permission_groups).toEqual([{ id: "p1" }]);
  });

  test.concurrent("skips policy entirely when all perms in a category are excluded", () => {
    const perm = makePerm("p1", "API Tokens", ["com.cloudflare.api.user"]);
    const result = buildPolicies(
      [perm],
      [],
      [],
      new Set(["API Tokens"]),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    expect(result).toHaveLength(0);
  });

  test.concurrent("effect is always 'allow'", () => {
    const perm = makePerm("p1", "DNS Read", ["com.cloudflare.api.user"]);
    const result = buildPolicies(
      [perm],
      [],
      [],
      new Set(),
      USER_RESOURCES,
      ACCOUNT_RESOURCES
    );
    for (const policy of result) {
      expect(policy.effect).toBe("allow");
    }
  });
});
