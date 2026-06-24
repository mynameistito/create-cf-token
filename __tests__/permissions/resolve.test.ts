import { describe, expect, test } from "bun:test";

import {
  appendServicePermissions,
  isAllScopesSelected,
  resolveFullAccessPermissions,
} from "@/permissions/resolve.ts";
import type { PermissionGroup, ServiceGroup } from "@/types/index.ts";

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

describe("appendServicePermissions", () => {
  test("grants only read permissions when level is read for write-only services", () => {
    const writePerm = perm("workers-write", "Workers Write");
    const service: ServiceGroup = {
      name: "Workers",
      otherPerms: [],
      perms: [writePerm],
      scopes: [ZONE_SCOPE],
      writePerm,
    };
    const chosen: PermissionGroup[] = [];

    appendServicePermissions(chosen, service, "read");

    expect(chosen).toEqual([]);
  });

  test("grants read permission when level is read for read-only services", () => {
    const { readPerm, service } = readOnlyServiceGroup();
    const chosen: PermissionGroup[] = [];

    appendServicePermissions(chosen, service, "read");

    expect(chosen).toEqual([readPerm]);
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
