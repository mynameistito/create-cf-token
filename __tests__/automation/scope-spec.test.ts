import { describe, expect, test } from "bun:test";

import {
  resolvePermissionsFromScopeSpec,
  resolvePresetPermissions,
  ScopeSpecError,
} from "#src/automation/scope-spec.ts";
import type { PermissionGroup, ServiceGroup } from "#src/types/index.ts";

const SCOPES: ServiceGroup[] = [
  {
    name: "Zone DNS",
    otherPerms: [],
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

const ALL_PERMS: PermissionGroup[] = [
  SCOPES[0]?.readPerm,
  SCOPES[0]?.writePerm,
].filter((perm): perm is PermissionGroup => perm !== undefined);

describe("resolvePermissionsFromScopeSpec", () => {
  test("resolves service:level syntax", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "Zone DNS:read"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("read-1");
  });

  test("resolves permission key:level syntax", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "zone_dns:write"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("write-1");
  });

  test("resolves quoted permission names", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "\"Zone DNS Read\", 'Zone DNS Write'"
    );
    expect(perms).toHaveLength(2);
    expect(perms.map((perm) => perm.id)).toEqual(["read-1", "write-1"]);
  });

  test("resolves permission by exact name", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "Zone DNS Read"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("read-1");
  });

  test("throws for unknown service", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Unknown:read")
    ).toThrow(ScopeSpecError);
  });

  test("throws for invalid access level on service entry", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Zone DNS:delete")
    ).toThrow(ScopeSpecError);

    try {
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Zone DNS:delete");
    } catch (error) {
      expect(ScopeSpecError.is(error)).toBe(true);
      if (ScopeSpecError.is(error)) {
        expect(error.message).toContain('Invalid access level "delete"');
      }
    }
  });

  test("throws for unknown permission key", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "bogus_key:read")
    ).toThrow(ScopeSpecError);

    try {
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "bogus_key:read");
    } catch (error) {
      expect(ScopeSpecError.is(error)).toBe(true);
      if (ScopeSpecError.is(error)) {
        expect(error.message).toContain('Unknown permission key "bogus_key"');
      }
    }
  });

  test("throws for empty scope spec", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "   ")
    ).toThrow(ScopeSpecError);

    try {
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "   ");
    } catch (error) {
      expect(ScopeSpecError.is(error)).toBe(true);
      if (ScopeSpecError.is(error)) {
        expect(error.message).toBe(
          "Scope spec is empty. Provide at least one scope."
        );
      }
    }
  });
});

describe("resolvePresetPermissions", () => {
  test("returns read and write permissions for every scope", () => {
    const perms = resolvePresetPermissions(SCOPES);
    expect(perms).toHaveLength(2);
    expect(perms.map((perm) => perm.id)).toEqual(["read-1", "write-1"]);
  });
});
