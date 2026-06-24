import { describe, expect, test } from "bun:test";

import { buildPermissionsForSelection } from "#src/prompts.ts";
import type { PermissionGroup, ServiceGroup } from "#src/types.ts";

const ZONE_SCOPE = "com.cloudflare.api.account.zone";

function perm(
  id: string,
  name: string,
  scopes: string[] = [ZONE_SCOPE]
): PermissionGroup {
  return { description: "", id, name, scopes };
}

function dnsServiceGroup(): {
  service: ServiceGroup;
  readPerm: PermissionGroup;
  writePerm: PermissionGroup;
  editPerm: PermissionGroup;
} {
  const readPerm = perm("dns-read", "DNS Read");
  const writePerm = perm("dns-write", "DNS Write");
  const editPerm = perm("dns-edit", "DNS Edit");

  return {
    editPerm,
    readPerm,
    service: {
      name: "DNS",
      otherPerms: [editPerm],
      perms: [readPerm, writePerm, editPerm],
      readPerm,
      scopes: [ZONE_SCOPE],
      writePerm,
    },
    writePerm,
  };
}

function readOnlyServiceGroup(): {
  service: ServiceGroup;
  readPerm: PermissionGroup;
} {
  const readPerm = perm("analytics-read", "DNS Analytics Read");

  return {
    readPerm,
    service: {
      name: "DNS Analytics",
      otherPerms: [],
      perms: [readPerm],
      readPerm,
      scopes: [ZONE_SCOPE],
    },
  };
}

describe("buildPermissionsForSelection", () => {
  test("read-only excludes edit-class otherPerms", async () => {
    const { service, readPerm } = dnsServiceGroup();
    const result = await buildPermissionsForSelection(
      [service],
      [service.name],
      () => Promise.resolve([]),
      () => Promise.resolve("read")
    );

    expect(result).toEqual([readPerm]);
  });

  test("read + write includes read, write, and edit permissions", async () => {
    const { service, readPerm, writePerm, editPerm } = dnsServiceGroup();
    const result = await buildPermissionsForSelection(
      [service],
      [service.name],
      () => Promise.resolve([]),
      () => Promise.resolve("write")
    );

    expect(result).toEqual([readPerm, writePerm, editPerm]);
  });

  test("service with only read includes read permission", async () => {
    const { service, readPerm } = readOnlyServiceGroup();
    const result = await buildPermissionsForSelection(
      [service],
      [service.name],
      () => Promise.resolve([])
    );

    expect(result).toEqual([readPerm]);
  });
});
