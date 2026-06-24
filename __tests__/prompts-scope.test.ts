import { describe, expect, test } from "bun:test";

import {
  buildPermissionsForSelection,
  GO_BACK,
  isAllScopesSelected,
  resolveFullAccessPermissions,
  shouldToggleSelectAll,
} from "#src/prompts/index.ts";
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

describe("shouldToggleSelectAll", () => {
  test("Ctrl+A always toggles", () => {
    expect(shouldToggleSelectAll({ ctrl: true, name: "a" }, false)).toBe(true);
    expect(shouldToggleSelectAll({ ctrl: true, name: "a" }, true)).toBe(true);
  });

  test("bare a toggles only after list navigation", () => {
    expect(shouldToggleSelectAll({ name: "a" }, true)).toBe(true);
    expect(shouldToggleSelectAll({ name: "a" }, false)).toBe(false);
  });

  test("ignores unrelated keys", () => {
    expect(shouldToggleSelectAll({ name: "b" }, true)).toBe(false);
    expect(shouldToggleSelectAll(undefined, true)).toBe(false);
  });
});

describe("isAllScopesSelected", () => {
  test("returns true when every scope is selected", () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();

    expect(
      isAllScopesSelected(
        [dns.service, analytics.service],
        [dns.service.name, analytics.service.name]
      )
    ).toBe(true);
  });

  test("returns false for partial or empty selections", () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();
    const scopes = [dns.service, analytics.service];

    expect(isAllScopesSelected(scopes, [dns.service.name])).toBe(false);
    expect(isAllScopesSelected(scopes, [])).toBe(false);
    expect(isAllScopesSelected([], [])).toBe(false);
  });
});

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

  test("skips unknown scope names", async () => {
    const { service, readPerm } = readOnlyServiceGroup();
    const result = await buildPermissionsForSelection(
      [service],
      ["Missing Service", service.name],
      () => Promise.resolve([]),
      () => Promise.resolve("read")
    );

    expect(result).toEqual([readPerm]);
  });

  test("resolves multiple selected services in order", async () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();
    const result = await buildPermissionsForSelection(
      [dns.service, analytics.service],
      [dns.service.name, analytics.service.name],
      () => Promise.resolve([]),
      () => Promise.resolve("read")
    );

    expect(result).toEqual([dns.readPerm, analytics.readPerm]);
  });

  test("returns reselectScopes result when access level is GO_BACK", async () => {
    const { service } = dnsServiceGroup();
    const reselected = [perm("reselected", "Re-selected")];
    const result = await buildPermissionsForSelection(
      [service],
      [service.name],
      () => Promise.resolve(reselected),
      () => Promise.resolve(GO_BACK)
    );

    expect(result).toEqual(reselected);
  });

  test("all scopes selected uses one bulk access level for read/write services", async () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();
    let accessLevelPrompts = 0;
    const result = await buildPermissionsForSelection(
      [dns.service, analytics.service],
      [dns.service.name, analytics.service.name],
      () => Promise.resolve([]),
      () => {
        accessLevelPrompts += 1;
        return Promise.resolve("write");
      }
    );

    expect(accessLevelPrompts).toBe(1);
    expect(result).toEqual([
      dns.readPerm,
      dns.writePerm,
      dns.editPerm,
      analytics.readPerm,
    ]);
  });

  test("all scopes selected with read-only bulk level excludes write perms", async () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();
    const result = await buildPermissionsForSelection(
      [dns.service, analytics.service],
      [dns.service.name, analytics.service.name],
      () => Promise.resolve([]),
      () => Promise.resolve("read")
    );

    expect(result).toEqual([dns.readPerm, analytics.readPerm]);
  });
});

describe("resolveFullAccessPermissions", () => {
  test("grants read, write, and edit for every read/write service", () => {
    const dns = dnsServiceGroup();
    const analytics = readOnlyServiceGroup();

    expect(
      resolveFullAccessPermissions([dns.service, analytics.service])
    ).toEqual([dns.readPerm, dns.writePerm, dns.editPerm, analytics.readPerm]);
  });

  test("omits API token management permissions", () => {
    const dns = dnsServiceGroup();
    const tokenRead = perm("tokens-read", "API Tokens Read", [
      "com.cloudflare.api.user",
    ]);
    const tokenWrite = perm("tokens-write", "API Tokens Write", [
      "com.cloudflare.api.user",
    ]);
    const tokenService: ServiceGroup = {
      name: "API Tokens",
      otherPerms: [],
      perms: [tokenRead, tokenWrite],
      readPerm: tokenRead,
      scopes: ["com.cloudflare.api.user"],
      writePerm: tokenWrite,
    };

    expect(resolveFullAccessPermissions([dns.service, tokenService])).toEqual([
      dns.readPerm,
      dns.writePerm,
      dns.editPerm,
    ]);
  });
});
