import type { PermissionGroup, ServiceGroup } from "#src/types.ts";

/** Action suffixes used to classify permission groups as read, write, or edit. */
const PERMISSION_ACTION_SUFFIXES = [
  { action: "read", suffix: " Read" },
  { action: "write", suffix: " Write" },
  { action: "edit", suffix: " Edit" },
] as const;

/** Markers that precede a permission group name in Cloudflare error messages. */
const PERMISSION_GROUP_MARKERS = [
  { allowUnquotedValue: true, marker: "permission group:" },
  { allowUnquotedValue: false, marker: "permission group" },
  { allowUnquotedValue: false, marker: "permission_group" },
] as const;

/** Characters that may appear between a marker and the actual permission name. */
const LEADING_PERMISSION_DELIMITERS = new Set([":", "=", "("]);

/** Characters that terminate an unquoted permission name in an error message. */
const TRAILING_PERMISSION_DELIMITERS = [")", ",", "\n", "\r"] as const;

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
    const normalizedBase = base.toLowerCase();
    const group = map.get(normalizedBase) ?? { name: base, perms: [] };
    group.perms.push(pg);
    map.set(normalizedBase, group);
  }

  return [...map.entries()]
    .map(([, { name, perms }]) => ({
      name,
      perms,
      readPerm: perms.find((pg) => hasPermissionAction(pg.name, "read")),
      writePerm: perms.find((pg) => hasPermissionAction(pg.name, "write")),
      otherPerms: perms.filter(
        (pg) =>
          !(
            hasPermissionAction(pg.name, "read") ||
            hasPermissionAction(pg.name, "write")
          )
      ),
      scopes: [...new Set(perms.flatMap((pg) => pg.scopes))],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalise unicode-escaped quotes and backslash-escaped quotes in error text
 * so the permission name extractor can match consistently.
 *
 * @param source - Raw error text from the Cloudflare API.
 * @returns The text with `\\u0022` and `\\"` replaced with plain `"`.
 */
function normalizePermissionSource(source: string): string {
  return source.replaceAll("\\u0022", '"').replaceAll('\\"', '"');
}

/**
 * Extract a permission group name from the text immediately following a marker.
 *
 * Handles both quoted values (`"Zone DNS Read"`) and, when `allowUnquotedValue`
 * is true, bare values terminated by a delimiter.
 *
 * @param segment - The text after the marker.
 * @param allowUnquotedValue - Whether to accept unquoted permission names.
 * @returns The extracted permission name, or `null` if nothing valid was found.
 */
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

  const openingQuote = value[0];
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

/**
 * Try to extract a failed permission name from a single error string.
 * Searches for known markers (`"permission group:"`, `"permission group"`, `"permission_group"`)
 * and parses the value that follows.
 *
 * @param source - One error message string.
 * @returns The extracted permission name, or `null`.
 */
function extractFailedPermFromSource(source: string): string | null {
  const normalizedSource = normalizePermissionSource(source);
  const lowercaseSource = normalizedSource.toLowerCase();

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
 * Extract a failed permission group name from Cloudflare API error text.
 *
 * Tries multiple known marker patterns and handles quoted/unquoted values.
 * Used by the token creation retry loop to identify which permission to exclude.
 *
 * @param errorText - A single error string or an array of error strings to search.
 * @returns The first successfully extracted permission name, or `null`.
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
