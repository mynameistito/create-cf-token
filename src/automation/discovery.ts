/**
 * @module automation/discovery
 *
 * Read-only introspection output for scopes, permissions, and accounts.
 */

import type { OutputFormat } from "@/cli/args.ts";
import type { Account, PermissionGroup, ServiceGroup } from "@/types/index.ts";

interface ScopeListEntry {
  access: {
    other: PermissionGroup[];
    read?: PermissionGroup;
    write?: PermissionGroup;
  };
  name: string;
  scopes: string[];
}

function toScopeListEntry(service: ServiceGroup): ScopeListEntry {
  return {
    access: {
      other: service.otherPerms,
      read: service.readPerm,
      write: service.writePerm,
    },
    name: service.name,
    scopes: service.scopes,
  };
}

export function formatScopesList(
  scopes: ServiceGroup[],
  format: OutputFormat
): string {
  const payload = {
    scopes: scopes.map(toScopeListEntry),
  };

  if (format === "json") {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  const lines = scopes.map((service) => {
    const levels: string[] = [];
    if (service.readPerm) {
      levels.push("read");
    }
    if (service.writePerm) {
      levels.push("write");
    }
    if (service.otherPerms.length > 0) {
      levels.push(`+${service.otherPerms.length} other`);
    }
    return `${service.name}  [${levels.join(", ")}]  (${service.scopes.join(", ")})`;
  });

  return `${lines.join("\n")}\n`;
}

export function formatPermissionsList(
  permissions: PermissionGroup[],
  format: OutputFormat
): string {
  const payload = { permissions };

  if (format === "json") {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  const lines = permissions.map(
    (perm) =>
      `${perm.id}\t${perm.key ?? "-"}\t${perm.name}\t${perm.scopes.join(", ")}`
  );

  return `${lines.join("\n")}\n`;
}

export function formatAccountsList(
  accounts: Account[],
  format: OutputFormat
): string {
  const payload = { accounts };

  if (format === "json") {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  const lines = accounts.map((account) => `${account.id}\t${account.name}`);
  return `${lines.join("\n")}\n`;
}
