import { describe, expect, test } from "bun:test";

import {
  resolvePermissionsFromScopeSpec,
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

  test("throws for unknown service", () => {
    expect(() =>
      resolvePermissionsFromScopeSpec(SCOPES, ALL_PERMS, "Unknown:read")
    ).toThrow(ScopeSpecError);
  });
});
