/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";

import * as fc from "fast-check";

import { extractFailedPerm, groupByService } from "#src/permissions.ts";
import type { PermissionGroup } from "#src/types.ts";

const permissionGroupArb = fc.record({
  description: fc.string(),
  id: fc.string({ minLength: 1 }),
  name: fc.string({ maxLength: 120, minLength: 1 }),
  scopes: fc.array(fc.string({ minLength: 1 }), { maxLength: 4 }),
}) as fc.Arbitrary<PermissionGroup>;

describe("property-based fuzzing", () => {
  test("extractFailedPerm handles arbitrary strings without throwing", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.array(fc.string(), { maxLength: 5 })),
        (input) => {
          expect(() => extractFailedPerm(input)).not.toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });

  test("groupByService preserves every input permission group", () => {
    fc.assert(
      fc.property(fc.array(permissionGroupArb, { maxLength: 40 }), (perms) => {
        const grouped = groupByService(perms);
        const groupedCount = grouped.reduce(
          (count, service) => count + service.perms.length,
          0
        );

        expect(groupedCount).toBe(perms.length);
      }),
      { numRuns: 100 }
    );
  });
});
