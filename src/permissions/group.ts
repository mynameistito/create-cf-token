/**
 * @module permissions/group
 *
 * Permission grouping and exclusion helpers.
 */

import type { PermissionGroup, ServiceGroup } from "@/types/index.ts";

/** Service group for API token management — sub-tokens cannot grant these to child tokens. */
export const TOKEN_MANAGEMENT_SERVICE = "API Tokens";

/** Action suffixes used to classify permission groups as read, write, or edit. */
const PERMISSION_ACTION_SUFFIXES = [
  { action: "read", suffix: " Read" },
  { action: "write", suffix: " Write" },
  { action: "edit", suffix: " Edit" },
] as const;

/** The action type extracted from a permission name suffix. */
type PermissionAction = (typeof PERMISSION_ACTION_SUFFIXES)[number]["action"];

/**
 * Check whether a permission name ends with a known action suffix.
 *
 * @param name - The permission group name to inspect.
 * @returns The matched action and suffix length, or `null` if no suffix matches.
 */
function matchPermissionAction(
  name: string
): { action: PermissionAction; suffixLength: number } | null {
  const trimmedName = name.trim();
  const normalizedName = trimmedName.toLowerCase();

  for (const { action, suffix } of PERMISSION_ACTION_SUFFIXES) {
    if (normalizedName.endsWith(suffix.toLowerCase())) {
      return { action, suffixLength: suffix.length };
    }
  }

  return null;
}

/**
 * Remove the trailing action suffix (Read/Write/Edit) from a permission name.
 *
 * @param name - The raw permission group name.
 * @returns The base name with the action suffix stripped.
 *
 * @example
 * stripPermissionActionSuffix("Zone DNS Read") // "Zone DNS"
 * stripPermissionActionSuffix("Account Settings") // "Account Settings"
 */
function stripPermissionActionSuffix(name: string): string {
  const trimmedName = name.trim();
  const actionMatch = matchPermissionAction(trimmedName);

  if (!actionMatch) {
    return trimmedName;
  }

  return trimmedName.slice(0, -actionMatch.suffixLength).trimEnd();
}

/**
 * Check whether a permission name has a specific action suffix.
 *
 * @param name - The permission group name.
 * @param action - The action to check for.
 * @returns `true` if the name ends with the given action suffix.
 */
function hasPermissionAction(name: string, action: PermissionAction): boolean {
  return matchPermissionAction(name)?.action === action;
}

/**
 * Group a flat list of permission groups into service-level buckets by stripping
 * Read/Write/Edit suffixes and collecting permissions that share the same base name.
 *
 * Each resulting {@linkcode ServiceGroup} separates read/write/other permissions
 * and deduplicates scopes.
 *
 * @param perms - All available permission groups from the Cloudflare API.
 * @returns Sorted array of service groups, alphabetically by name.
 */
export function groupByService(perms: PermissionGroup[]): ServiceGroup[] {
  const map = new Map<
    string,
    {
      name: string;
      perms: PermissionGroup[];
    }
  >();

  for (const pg of perms) {
    const base = stripPermissionActionSuffix(pg.name);
    const groupKey = base.toLowerCase();
    const group = map.get(groupKey) ?? { name: base, perms: [] };
    group.perms.push(pg);
    map.set(groupKey, group);
  }

  return [...map.entries()]
    .map(([, { name, perms: permissionGroups }]) => ({
      name,
      otherPerms: permissionGroups.filter(
        (pg) =>
          !(
            hasPermissionAction(pg.name, "read") ||
            hasPermissionAction(pg.name, "write")
          )
      ),
      perms: permissionGroups,
      readPerm: permissionGroups.find((pg) =>
        hasPermissionAction(pg.name, "read")
      ),
      scopes: [...new Set(permissionGroups.flatMap((pg) => pg.scopes))],
      writePerm: permissionGroups.find((pg) =>
        hasPermissionAction(pg.name, "write")
      ),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

const PERMISSION_GROUP_MARKERS = [
  { allowUnquotedValue: true, marker: "permission group:" },
  { allowUnquotedValue: false, marker: "permission group" },
  { allowUnquotedValue: false, marker: "permission_group" },
] as const;

const LEADING_PERMISSION_DELIMITERS = new Set([":", "=", "("]);
const TRAILING_PERMISSION_DELIMITERS = [")", ",", "\n", "\r"] as const;

function normalizePermissionSource(source: string): string {
  return source.replaceAll("\\u0022", '"').replaceAll('\\"', '"');
}

function takePermissionValue(
  segment: string,
  allowUnquotedValue: boolean
): string | null {
  let value = segment.trimStart();

  while (
    value.length > 0 &&
    LEADING_PERMISSION_DELIMITERS.has(value[0] ?? "")
  ) {
    value = value.slice(1).trimStart();
  }

  if (value.length === 0) {
    return null;
  }

  const [openingQuote] = value;
  if (openingQuote === '"' || openingQuote === "'") {
    const closingQuoteIndex = value.indexOf(openingQuote, 1);
    if (closingQuoteIndex >= 2) {
      const quotedValue = value.slice(1, closingQuoteIndex).trim();
      return quotedValue.length > 0 ? quotedValue : null;
    }

    return null;
  }

  if (!allowUnquotedValue) {
    return null;
  }

  let endIndex = value.length;
  for (const delimiter of TRAILING_PERMISSION_DELIMITERS) {
    const delimiterIndex = value.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      endIndex = Math.min(endIndex, delimiterIndex);
    }
  }

  const unquotedValue = value.slice(0, endIndex).trim();
  return unquotedValue.length > 0 ? unquotedValue : null;
}

function extractFailedPermFromSource(source: string): string | null {
  const normalizedSource = normalizePermissionSource(source);
  const lowercaseSource = normalizedSource.toLowerCase();

  if (
    lowercaseSource.includes(
      "sub-token is not allowed to have permissions to manage other tokens"
    )
  ) {
    return TOKEN_MANAGEMENT_SERVICE;
  }

  for (const { allowUnquotedValue, marker } of PERMISSION_GROUP_MARKERS) {
    const markerIndex = lowercaseSource.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const permissionName = takePermissionValue(
      normalizedSource.slice(markerIndex + marker.length),
      allowUnquotedValue
    );
    if (permissionName) {
      return permissionName;
    }
  }

  return null;
}

/**
 * Whether a permission should be omitted from token policies.
 * Matches exact permission names and service base names (e.g. `API Tokens` excludes `API Tokens Write`).
 *
 * @param permissionName - Full permission group name from the Cloudflare API.
 * @param excluded - Permission or service names to omit.
 * @returns `true` when the permission or its service base name is in `excluded`.
 */
export function isPermissionExcluded(
  permissionName: string,
  excluded: Set<string>
): boolean {
  if (excluded.has(permissionName)) {
    return true;
  }

  return excluded.has(stripPermissionActionSuffix(permissionName));
}

/**
 * Permission names to pre-exclude for token-management groups (sub-tokens cannot grant these).
 *
 * @param perms - All available permission groups from the Cloudflare API.
 * @returns Set of permission names under the {@link TOKEN_MANAGEMENT_SERVICE} service.
 */
export function buildTokenManagementExclusions(
  perms: PermissionGroup[]
): Set<string> {
  const marker = new Set([TOKEN_MANAGEMENT_SERVICE]);
  const excluded = new Set<string>();

  for (const perm of perms) {
    if (isPermissionExcluded(perm.name, marker)) {
      excluded.add(perm.name);
    }
  }

  return excluded;
}

/**
 * Parse a restricted permission name from Cloudflare token-create error text.
 *
 * Handles `permission group:` markers, quoted values, and the sub-token management message.
 *
 * @param errorText - Raw API error body or message list from `POST /user/tokens`.
 * @returns Matched permission or service name, or `null` when none is found.
 */
export function extractFailedPerm(
  errorText: readonly string[] | string
): string | null {
  const sources = Array.isArray(errorText) ? errorText : [errorText];

  for (const source of sources) {
    const permissionName = extractFailedPermFromSource(source);
    if (permissionName) {
      return permissionName;
    }
  }

  return null;
}
