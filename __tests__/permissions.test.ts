/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import { extractFailedPerm, groupByService } from "#src/permissions.ts";

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
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
  });

  test("returns null when the response does not include a permission group value", () => {
    const cases = [
      {
        error: "An unexpected error occurred",
        expected: null,
      },
      {
        error: "",
        expected: null,
      },
      {
        error: "this permission group is invalid",
        expected: null,
      },
      {
        error: 'A selected permission cannot be granted (Permission group: "")',
        expected: null,
      },
    ] as const;

    for (const { error, expected } of cases) {
      expect(extractFailedPerm(error)).toBe(expected);
    }
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
});
