/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import { extractFailedPerm } from "../src/permissions.ts";

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
