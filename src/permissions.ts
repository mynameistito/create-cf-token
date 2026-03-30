import type { PermissionGroup, ServiceGroup } from "./types.ts";

const RE_SUFFIX = /\s+(Read|Write|Edit)$/i;
const RE_READ = /\bRead$/i;
const RE_WRITE = /\bWrite$/i;
const RE_READ_OR_WRITE = /\b(Read|Write)$/i;
const RE_PERM_GROUP_ESCAPED =
  /Permission group:\s*\\?"?\\u0022?(.+?)\\u0022?"?\\?"\s*\)/;
const RE_PERM_GROUP_QUOTED = /Permission group:\s*"?(.+?)"?\s*\)/;
const RE_PERM_GROUP_ALT = /permission[_ ]group[^"]*"([^"]+)"/i;

/** Group flat permission list into services by stripping Read/Write/Edit suffixes. */
export function groupByService(perms: PermissionGroup[]): ServiceGroup[] {
  const map = new Map<string, PermissionGroup[]>();

  for (const pg of perms) {
    const base = pg.name.replace(RE_SUFFIX, "").trim();
    const group = map.get(base) ?? [];
    group.push(pg);
    map.set(base, group);
  }

  return [...map.entries()]
    .map(([name, perms]) => ({
      name,
      perms,
      readPerm: perms.find((pg) => RE_READ.test(pg.name)),
      writePerm: perms.find((pg) => RE_WRITE.test(pg.name)),
      otherPerms: perms.filter((pg) => !RE_READ_OR_WRITE.test(pg.name)),
      scopes: [...new Set(perms.flatMap((pg) => pg.scopes))],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Extract a failed permission group name from a CF error response. */
export function extractFailedPerm(errorText: string): string | null {
  const patterns = [
    RE_PERM_GROUP_ESCAPED,
    RE_PERM_GROUP_QUOTED,
    RE_PERM_GROUP_ALT,
  ];
  for (const re of patterns) {
    const m = errorText.match(re);
    if (m?.[1]) {
      return m[1]
        .trim()
        .replace(/\\u0022/g, "")
        .replace(/"/g, "");
    }
  }
  return null;
}
