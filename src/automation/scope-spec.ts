/**
 * @module automation/scope-spec
 *
 * Non-interactive scope spec parsing and permission resolution.
 */

import { ScopeSpecErrorBase } from "@/errors/bases.ts";
import { TOKEN_MANAGEMENT_SERVICE } from "@/permissions/group.ts";
import {
  appendServicePermissions,
  resolveFullAccessPermissions,
} from "@/permissions/resolve.ts";
import type { PermissionGroup, ServiceGroup } from "@/types/index.ts";

/** Thrown when a scope spec string is invalid or references unknown services/permissions. */
class ScopeSpecError extends ScopeSpecErrorBase {}

/** Instance type of {@linkcode ScopeSpecError}. */
export type ScopeSpecErrorType = InstanceType<typeof ScopeSpecError>;

type AccessLevel = "read" | "write";

function parseScopeEntries(spec: string): string[] {
  const entries: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (const char of spec) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (inQuotes) {
      if (char === quoteChar) {
        inQuotes = false;
        quoteChar = "";
        if (current.trim()) {
          entries.push(current.trim());
          current = "";
        }
        continue;
      }
      current += char;
      continue;
    }

    if (char === ",") {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

function findServiceByName(
  scopes: ServiceGroup[],
  name: string
): ServiceGroup | undefined {
  const normalized = name.trim().toLowerCase();
  return scopes.find((scope) => scope.name.toLowerCase() === normalized);
}

function findPermissionByKey(
  allPerms: PermissionGroup[],
  key: string,
  level?: AccessLevel
): PermissionGroup | undefined {
  const normalizedKey = key.trim().toLowerCase();
  const matches = allPerms.filter(
    (perm) => perm.key?.toLowerCase() === normalizedKey
  );

  if (level) {
    const suffix = level === "read" ? " read" : " write";
    return matches.find((perm) => perm.name.toLowerCase().endsWith(suffix));
  }

  return matches[0];
}

function findPermissionByName(
  allPerms: PermissionGroup[],
  name: string
): PermissionGroup | undefined {
  const normalized = name.trim().toLowerCase();
  return allPerms.find((perm) => perm.name.toLowerCase() === normalized);
}

function resolveServiceLevelEntry(
  scopes: ServiceGroup[],
  entry: string
): PermissionGroup[] {
  const colonIndex = entry.lastIndexOf(":");
  if (colonIndex <= 0) {
    throw new ScopeSpecError({
      message: `Invalid scope entry "${entry}". Expected "Service Name:read" or "Service Name:write".`,
    });
  }

  const serviceName = entry.slice(0, colonIndex).trim();
  const level = entry
    .slice(colonIndex + 1)
    .trim()
    .toLowerCase();

  if (level !== "read" && level !== "write") {
    throw new ScopeSpecError({
      message: `Invalid access level "${level}" in "${entry}". Use "read" or "write".`,
    });
  }

  const service = findServiceByName(scopes, serviceName);
  if (!service) {
    throw new ScopeSpecError({
      message: `Unknown service "${serviceName}". Run create-cf-token --list-scopes --json to discover available scopes.`,
    });
  }

  const chosen: PermissionGroup[] = [];
  appendServicePermissions(chosen, service, level);
  return chosen;
}

function resolveKeyLevelEntry(
  allPerms: PermissionGroup[],
  entry: string
): PermissionGroup {
  const colonIndex = entry.lastIndexOf(":");
  if (colonIndex <= 0) {
    throw new ScopeSpecError({
      message: `Invalid permission key entry "${entry}". Expected "permission_key:read" or "permission_key:write".`,
    });
  }

  const key = entry.slice(0, colonIndex).trim();
  const level = entry
    .slice(colonIndex + 1)
    .trim()
    .toLowerCase();

  if (level !== "read" && level !== "write") {
    throw new ScopeSpecError({
      message: `Invalid access level "${level}" in "${entry}". Use "read" or "write".`,
    });
  }

  const perm = findPermissionByKey(allPerms, key, level);
  if (!perm) {
    throw new ScopeSpecError({
      message: `Unknown permission key "${key}" with level "${level}". Run create-cf-token --list-permissions --json to discover keys.`,
    });
  }

  return perm;
}

/**
 * Resolve a declarative scope spec string to concrete permission groups.
 *
 * Supports three entry formats (comma-separated):
 * - Service + level: `Workers Scripts:write`
 * - Permission key + level: `workers_scripts:write`
 * - Exact permission name: `"Workers Scripts Write"` (quote names containing commas)
 *
 * @param scopes - Service-level groupings from {@linkcode groupByService}.
 * @param allPerms - All assignable permission groups from the Cloudflare API.
 * @param spec - Comma-separated scope spec string.
 * @returns Deduplicated permission groups matching the spec.
 * @throws {ScopeSpecError} When the spec is empty, malformed, or references unknown entries.
 */
export function resolvePermissionsFromScopeSpec(
  scopes: ServiceGroup[],
  allPerms: PermissionGroup[],
  spec: string
): PermissionGroup[] {
  const entries = parseScopeEntries(spec);
  if (entries.length === 0) {
    throw new ScopeSpecError({
      message: "Scope spec is empty. Provide at least one scope.",
    });
  }

  const chosen: PermissionGroup[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    let resolved: PermissionGroup[];

    if (entry.includes(":")) {
      const byService = findServiceByName(scopes, entry.split(":")[0] ?? "");
      resolved = byService
        ? resolveServiceLevelEntry(scopes, entry)
        : [resolveKeyLevelEntry(allPerms, entry)];
    } else {
      const byName = findPermissionByName(allPerms, entry);
      if (!byName) {
        throw new ScopeSpecError({
          message: `Unknown permission "${entry}". Use service:level, key:level, or an exact permission name.`,
        });
      }
      resolved = [byName];
    }

    for (const perm of resolved) {
      if (!seen.has(perm.id)) {
        seen.add(perm.id);
        chosen.push(perm);
      }
    }
  }

  return chosen;
}

/**
 * Resolve permissions for the `full-access` preset (all scopes at read+write).
 *
 * Excludes API token management permissions via {@linkcode resolveFullAccessPermissions}.
 *
 * @param scopes - Service-level groupings from {@linkcode groupByService}.
 * @returns All non–token-management permissions at read and write levels.
 */
export function resolvePresetPermissions(
  scopes: ServiceGroup[]
): PermissionGroup[] {
  return resolveFullAccessPermissions(scopes);
}

export { ScopeSpecError, TOKEN_MANAGEMENT_SERVICE };
