import { describe, expect, test } from "bun:test";

import {
  resolvePermissionsFromScopeSpec,
  resolvePresetPermissions,
  ScopeSpecError,
} from "@/automation/scope-spec.ts";
import type { PermissionGroup, ServiceGroup } from "@/types/index.ts";

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
  test.concurrent("resolves service:level syntax", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "Zone DNS:read"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("read-1");
  });

  test.concurrent("resolves permission key:level syntax", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "zone_dns:write"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("write-1");
  });

  test.concurrent("resolves quoted permission names", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "\"Zone DNS Read\", 'Zone DNS Write'"
    );
    expect(perms).toHaveLength(2);
    expect(perms.map((perm) => perm.id)).toEqual(["read-1", "write-1"]);
  });

  test.concurrent("resolves permission by exact name", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "Zone DNS Read"
    );
    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("read-1");
  });

  test.concurrent("deduplicates permissions resolved by multiple entries", () => {
    const perms = resolvePermissionsFromScopeSpec(
      SCOPES,
      ALL_PERMS,
      "Zone DNS:read, zone_dns:read, 'Zone DNS Read'"
    );

    expect(perms).toHaveLength(1);
    expect(perms[0]?.id).toBe("read-1");
  });

  test.concurrent("grants only read permissions for service:read entries on write-only services", () => {
    const writeOnlyScopes: ServiceGroup[] = [
      {
        name: "Workers",
        otherPerms: [],
        perms: [],
        scopes: ["com.cloudflare.api.account.zone"],
        writePerm: {
          description: "",
          id: "workers-write",
          key: "workers",
          name: "Workers Write",
          scopes: ["com.cloudflare.api.account.zone"],
        },
      },
    ];
    const allPerms = writeOnlyScopes
      .map((scope) => scope.writePerm)
      .filter((perm): perm is PermissionGroup => perm !== undefined);

    const perms = resolvePermissionsFromScopeSpec(
      writeOnlyScopes,
      allPerms,
      "Workers:read"
    );

    expect(perms).toEqual([]);
  });

  test.concurrent("throws for unknown service", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Unknown:read")
    ).toThrow(ScopeSpecError);
  });

  test.concurrent("throws for invalid access level on service entry", () => {
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

  test.concurrent("throws for unknown permission key", () => {
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

  test.concurrent("throws for malformed permission key entries", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, ":read")
    ).toThrow(ScopeSpecError);

    try {
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "zone_dns:admin");
    } catch (error) {
      expect(ScopeSpecError.is(error)).toBe(true);
      if (ScopeSpecError.is(error)) {
        expect(error.message).toContain('Invalid access level "admin"');
      }
    }
  });

  test.concurrent("throws for unknown exact permission names", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Missing Permission")
    ).toThrow(ScopeSpecError);

    try {
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Missing Permission");
    } catch (error) {
      expect(ScopeSpecError.is(error)).toBe(true);
      if (ScopeSpecError.is(error)) {
        expect(error.message).toContain(
          'Unknown permission "Missing Permission"'
        );
      }
    }
  });

  test.concurrent("throws for empty scope spec", () => {
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
  test.concurrent("returns read and write permissions for every scope", () => {
    const perms = resolvePresetPermissions(SCOPES);
    expect(perms).toHaveLength(2);
    expect(perms.map((perm) => perm.id)).toEqual(["read-1", "write-1"]);
  });
});
