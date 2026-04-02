import type { PermissionGroup, ServiceGroup } from "./types.ts";

const PERMISSION_ACTION_SUFFIXES = [
  { action: "read", suffix: " Read" },
  { action: "write", suffix: " Write" },
  { action: "edit", suffix: " Edit" },
] as const;
const PERMISSION_GROUP_MARKERS = [
  { allowUnquotedValue: true, marker: "permission group:" },
  { allowUnquotedValue: false, marker: "permission group" },
  { allowUnquotedValue: false, marker: "permission_group" },
] as const;
const LEADING_PERMISSION_DELIMITERS = new Set([":", "=", "("]);
const TRAILING_PERMISSION_DELIMITERS = [")", ",", "\n", "\r"] as const;

type PermissionAction = (typeof PERMISSION_ACTION_SUFFIXES)[number]["action"];

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

function stripPermissionActionSuffix(name: string): string {
  const trimmedName = name.trim();
  const actionMatch = matchPermissionAction(trimmedName);

  if (!actionMatch) {
    return trimmedName;
  }

  return trimmedName.slice(0, -actionMatch.suffixLength).trimEnd();
}

function hasPermissionAction(name: string, action: PermissionAction): boolean {
  return matchPermissionAction(name)?.action === action;
}

/** Group flat permission list into services by stripping Read/Write/Edit suffixes. */
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

/** Extract a failed permission group name from a CF error response. */
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
