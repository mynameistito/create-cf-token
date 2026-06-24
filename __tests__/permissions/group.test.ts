/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import {
  extractFailedPerm,
  groupByService,
  isPermissionExcluded,
} from "@/permissions/group.ts";

describe("extractFailedPerm", () => {
  test("extracts restricted permission names from supported Cloudflare error formats", () => {
    const cases = [
      {
        error: [
          'A selected permission cannot be granted (Permission group: "API Tokens Write")',
        ],
        expected: "API Tokens Write",
      },
      {
        error:
          'A selected permission cannot be granted (Permission group: "X")',
        expected: "X",
      },
      {
        error:
          '{"errors":[{"message":"A selected permission cannot be granted (Permission group: \\"Zone WAF Write\\")"}]}',
        expected: "Zone WAF Write",
      },
      {
        error:
          '{"errors":[{"message":"A selected permission cannot be granted (Permission group: \\u0022DNS Write\\u0022)"}]}',
        expected: "DNS Write",
      },
      {
        error: 'validation failed for permission_group "Account Settings Read"',
        expected: "Account Settings Read",
      },
      {
        error:
          '{"success":false,"errors":[{"code":1001,"message":"sub-token is not allowed to have permissions to manage other tokens"}]}',
        expected: "API Tokens",
      },
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
  });

  test("returns null when the response does not include a permission group value", () => {
    const cases = [
      { error: "An unexpected error occurred", expected: null },
      { error: "", expected: null },
      { error: "this permission group is invalid", expected: null },
      {
        error: 'A selected permission cannot be granted (Permission group: "")',
        expected: null,
      },
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
  });

  test("extracts single-quoted permission names", () => {
    expect(
      extractFailedPerm(
        "A selected permission cannot be granted (Permission group: 'Zone Cache Purge')"
      )
    ).toBe("Zone Cache Purge");
  });

  test("returns null for malformed quoted values without a closing quote", () => {
    expect(
      extractFailedPerm('Permission group: "Unclosed Permission')
    ).toBeNull();
  });

  test("extracts unquoted values after permission group: markers", () => {
    const cases = [
      {
        error:
          "A selected permission cannot be granted (Permission group: DNS Write)",
        expected: "DNS Write",
      },
      {
        error:
          "A selected permission cannot be granted (Permission group: = DNS Write)",
        expected: "DNS Write",
      },
      {
        error:
          "A selected permission cannot be granted (Permission group: (DNS Write))",
        expected: "DNS Write",
      },
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
  });

  test("strips trailing delimiters from unquoted permission values", () => {
    const cases = [
      {
        error:
          "A selected permission cannot be granted (Permission group: DNS Write)",
        expected: "DNS Write",
      },
      {
        error:
          "A selected permission cannot be granted (Permission group: DNS Write, other context)",
        expected: "DNS Write",
      },
      {
        error:
          "A selected permission cannot be granted (Permission group: DNS Write\nmore text)",
        expected: "DNS Write",
      },
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
  });

  test("requires quoted values for permission_group markers", () => {
    expect(
      extractFailedPerm("validation failed for permission_group DNS Write")
    ).toBeNull();
    expect(
      extractFailedPerm(
        'validation failed for permission_group "Account Settings Read"'
      )
    ).toBe("Account Settings Read");
  });
});

describe("isPermissionExcluded", () => {
  test("matches exact permission names", () => {
    const excluded = new Set(["DNS Write"]);
    expect(isPermissionExcluded("DNS Write", excluded)).toBe(true);
    expect(isPermissionExcluded("DNS Read", excluded)).toBe(false);
  });

  test("matches service base names across read, write, and edit permissions", () => {
    const excluded = new Set(["API Tokens"]);
    expect(isPermissionExcluded("API Tokens Read", excluded)).toBe(true);
    expect(isPermissionExcluded("API Tokens Write", excluded)).toBe(true);
    expect(isPermissionExcluded("API Tokens Edit", excluded)).toBe(true);
    expect(isPermissionExcluded("DNS Read", excluded)).toBe(false);
  });
});

describe("groupByService", () => {
  test("groups read, write, and edit permissions without regex suffix parsing", () => {
    const groups = groupByService([
      {
        description: "Allows editing DNS",
        id: "dns-edit",
        name: "DNS Edit",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "Allows reading DNS",
        id: "dns-read",
        name: "DNS Read",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "Allows writing DNS",
        id: "dns-write",
        name: "DNS Write",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "A non-standard permission label",
        id: "dns-analytics",
        name: "DNS Analytics",
        scopes: ["com.cloudflare.api.account.zone"],
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.name).toBe("DNS");
    expect(groups[0]?.readPerm?.id).toBe("dns-read");
    expect(groups[0]?.writePerm?.id).toBe("dns-write");
    expect(groups[0]?.otherPerms.map((permission) => permission.id)).toEqual([
      "dns-edit",
    ]);
    expect(groups[1]?.name).toBe("DNS Analytics");
  });

  test("groups read, write, and edit permissions case-insensitively", () => {
    const groups = groupByService([
      {
        description: "Allows reading DNS",
        id: "dns-read",
        name: "dns read",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "Allows writing DNS",
        id: "dns-write",
        name: "DNS Write",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "Allows editing DNS",
        id: "dns-edit",
        name: "Dns Edit",
        scopes: ["com.cloudflare.api.account.zone"],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("dns");
    expect(groups[0]?.readPerm?.id).toBe("dns-read");
    expect(groups[0]?.writePerm?.id).toBe("dns-write");
    expect(groups[0]?.otherPerms.map((permission) => permission.id)).toEqual([
      "dns-edit",
    ]);
  });

  test("recognizes action suffixes consistently when names include leading whitespace", () => {
    const groups = groupByService([
      {
        description: "Allows reading DNS",
        id: "dns-read",
        name: "  DNS Read",
        scopes: ["com.cloudflare.api.account.zone"],
      },
      {
        description: "Allows writing DNS",
        id: "dns-write",
        name: " DNS Write",
        scopes: ["com.cloudflare.api.account.zone"],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("DNS");
    expect(groups[0]?.readPerm?.id).toBe("dns-read");
    expect(groups[0]?.writePerm?.id).toBe("dns-write");
    expect(groups[0]?.otherPerms).toEqual([]);
  });

  test("merges permissions that share a base name across different scopes", () => {
    const groups = groupByService([
      {
        description: "Account-level workers read",
        id: "workers-account-read",
        name: "Workers Read",
        scopes: ["com.cloudflare.api.account"],
      },
      {
        description: "Zone-level workers read",
        id: "workers-zone-read",
        name: "Workers Read",
        scopes: ["com.cloudflare.api.account.zone"],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("Workers");
    expect(groups.map((group) => group.name)).toEqual(["Workers"]);
    expect(groups[0]?.scopes).toEqual([
      "com.cloudflare.api.account",
      "com.cloudflare.api.account.zone",
    ]);
  });
});
