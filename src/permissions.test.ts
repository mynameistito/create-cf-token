/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import { extractFailedPerm } from "./permissions.ts";

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
});
