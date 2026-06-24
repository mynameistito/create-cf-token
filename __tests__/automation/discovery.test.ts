import { describe, expect, test } from "bun:test";

import {
  formatAccountsList,
  formatPermissionsList,
  formatScopesList,
} from "@/automation/discovery.ts";
import type { Account, PermissionGroup, ServiceGroup } from "@/types/index.ts";

const SCOPES: ServiceGroup[] = [
  {
    name: "Zone DNS",
    otherPerms: [
      {
        description: "",
        id: "other-1",
        name: "Zone DNS Purge",
        scopes: ["com.cloudflare.api.account.zone"],
      },
    ],
    perms: [],
    readPerm: {
      description: "",
      id: "read-1",
      key: "zone_dns",
      name: "Zone DNS Read",
      scopes: ["com.cloudflare.api.account.zone"],
    },
    scopes: ["com.cloudflare.api.account.zone"],
    writePerm: {
      description: "",
      id: "write-1",
      key: "zone_dns",
      name: "Zone DNS Write",
      scopes: ["com.cloudflare.api.account.zone"],
    },
  },
];

const PERMISSIONS: PermissionGroup[] = [
  {
    description: "",
    id: "perm-1",
    key: "zone_dns",
    name: "Zone DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

const ACCOUNTS: Account[] = [{ id: "acct-1", name: "Acme Corp" }];

describe("formatScopesList", () => {
  test("formats scopes as JSON", () => {
    const output = formatScopesList(SCOPES, "json");
    const parsed = JSON.parse(output) as {
      scopes: { name: string; scopes: string[] }[];
    };

    expect(parsed.scopes).toHaveLength(1);
    expect(parsed.scopes[0]?.name).toBe("Zone DNS");
    expect(parsed.scopes[0]?.scopes).toEqual([
      "com.cloudflare.api.account.zone",
    ]);
  });

  test("formats scopes as a table", () => {
    const output = formatScopesList(SCOPES, "table");
    expect(output).toBe(
      "Zone DNS  [read, write, +1 other]  (com.cloudflare.api.account.zone)\n"
    );
  });
});

describe("formatPermissionsList", () => {
  test("formats permissions as JSON", () => {
    const output = formatPermissionsList(PERMISSIONS, "json");
    const parsed = JSON.parse(output) as { permissions: PermissionGroup[] };

    expect(parsed.permissions).toEqual(PERMISSIONS);
  });

  test("formats permissions as a table", () => {
    const output = formatPermissionsList(PERMISSIONS, "table");
    expect(output).toBe(
      "perm-1\tzone_dns\tZone DNS Read\tcom.cloudflare.api.account.zone\n"
    );
  });
});

describe("formatAccountsList", () => {
  test("formats accounts as JSON", () => {
    const output = formatAccountsList(ACCOUNTS, "json");
    const parsed = JSON.parse(output) as { accounts: Account[] };

    expect(parsed.accounts).toEqual(ACCOUNTS);
  });

  test("formats accounts as a table", () => {
    const output = formatAccountsList(ACCOUNTS, "table");
    expect(output).toBe("acct-1\tAcme Corp\n");
  });
});
