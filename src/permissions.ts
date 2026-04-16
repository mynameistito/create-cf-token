import type { PermissionGroup, ServiceGroup } from "#src/types.ts";

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
