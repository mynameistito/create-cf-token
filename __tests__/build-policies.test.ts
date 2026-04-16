import { describe, expect, test } from "bun:test";
import { buildPolicies } from "#src/index.ts";
import type { Account, TokenPolicy } from "#src/types.ts";

const USER_ID = "user-abc";
const ACCOUNTS: Account[] = [
  { id: "acct-1", name: "Acme" },
  { id: "acct-2", name: "Widgets" },
];

describe("buildPolicies", () => {
  test("user-scoped perms use userId resource URI", () => {
    const perms = [
      { id: "p1", name: "User Details Read", description: "", scopes: ["com.cloudflare.api.user"] },
    ];
    const [policy] = buildPolicies(perms, USER_ID, ACCOUNTS);
    expect(policy?.resources).toEqual({ [`com.cloudflare.api.user.${USER_ID}`]: "*" });
    expect(policy?.permission_groups).toEqual([{ id: "p1" }]);
  });

  test("account-scoped perms use one resource URI per selected account", () => {
    const perms = [
      { id: "p2", name: "Account Settings Edit", description: "", scopes: ["com.cloudflare.api.account"] },
    ];
    const [policy] = buildPolicies(perms, USER_ID, ACCOUNTS);
    expect(policy?.resources).toEqual({
      "com.cloudflare.api.account.acct-1": "*",
      "com.cloudflare.api.account.acct-2": "*",
    });
  });

  test("zone-scoped perms treated as account-scoped", () => {
    const perms = [
      { id: "p3", name: "DNS Read", description: "", scopes: ["com.cloudflare.api.account.zone"] },
    ];
    const [policy] = buildPolicies(perms, USER_ID, ACCOUNTS);
    expect(policy?.resources).toEqual({
      "com.cloudflare.api.account.acct-1": "*",
      "com.cloudflare.api.account.acct-2": "*",
    });
  });

  test("mixed user and account perms produce two policies", () => {
    const perms = [
      { id: "p1", name: "User Details Read", description: "", scopes: ["com.cloudflare.api.user"] },
      { id: "p2", name: "DNS Read", description: "", scopes: ["com.cloudflare.api.account.zone"] },
    ];
    const policies = buildPolicies(perms, USER_ID, ACCOUNTS);
    expect(policies).toHaveLength(2);
  });

  test("all policies have effect allow", () => {
    const perms = [
      { id: "p1", name: "DNS Read", description: "", scopes: ["com.cloudflare.api.account.zone"] },
    ];
    const policies = buildPolicies(perms, USER_ID, ACCOUNTS);
    expect(policies.every((p: TokenPolicy) => p.effect === "allow")).toBe(true);
  });

  test("returns empty array for empty permissions", () => {
    expect(buildPolicies([], USER_ID, ACCOUNTS)).toEqual([]);
  });

  test("single selected account scopes correctly", () => {
    const perms = [
      { id: "p1", name: "DNS Read", description: "", scopes: ["com.cloudflare.api.account.zone"] },
    ];
    const [policy] = buildPolicies(perms, USER_ID, [ACCOUNTS[0]!]);
    expect(policy?.resources).toEqual({ "com.cloudflare.api.account.acct-1": "*" });
  });
});
