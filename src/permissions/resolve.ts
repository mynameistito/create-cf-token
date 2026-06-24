import { TOKEN_MANAGEMENT_SERVICE } from "@/permissions/group.ts";
import type { PermissionGroup, ServiceGroup } from "@/types/index.ts";

/** Read-only vs read+write selection for services that expose both permission groups. */
export type AccessLevel = "read" | "write";

/**
 * Returns `true` when every available service scope is selected.
 *
 * @param scopes - All available service groups.
 * @param selected - Names of scopes the user checked in the multi-select.
 * @returns `true` when every service group name is present in `selected`.
 */
export function isAllScopesSelected(
  scopes: ServiceGroup[],
  selected: string[]
): boolean {
  if (scopes.length === 0 || selected.length !== scopes.length) {
    return false;
  }

  const scopeNames = new Set(scopes.map((scope) => scope.name));
  const selectedNames = new Set(selected);
  return (
    selectedNames.size === scopes.length &&
    selected.every((name) => scopeNames.has(name))
  );
}

/**
 * Whether a single bulk access-level prompt should replace per-service prompts.
 *
 * @param scopes - All available service groups.
 * @param selected - Names of scopes the user checked in the multi-select.
 * @returns `true` when all scopes are selected and at least one has both read and write permissions.
 */
export function shouldUseBulkAccessLevel(
  scopes: ServiceGroup[],
  selected: string[]
): boolean {
  return (
    isAllScopesSelected(scopes, selected) &&
    scopes.some((scope) => scope.readPerm && scope.writePerm)
  );
}

/**
 * Append a service's permission groups to the chosen list.
 *
 * @param chosen - Accumulator for resolved permission groups.
 * @param service - The service whose permissions should be added.
 * @param level - Access level for read/write services; omitted for read-only services.
 */
export function appendServicePermissions(
  chosen: PermissionGroup[],
  service: ServiceGroup,
  level?: AccessLevel
): void {
  if (service.readPerm && service.writePerm) {
    chosen.push(service.readPerm);
    if (level === "write") {
      chosen.push(service.writePerm);
      chosen.push(...service.otherPerms);
    }
    return;
  }

  if (level === undefined) {
    chosen.push(...service.otherPerms);
    if (service.readPerm) {
      chosen.push(service.readPerm);
    }
    if (service.writePerm) {
      chosen.push(service.writePerm);
    }
    return;
  }

  if (level === "read") {
    if (service.readPerm) {
      chosen.push(service.readPerm);
    }
    return;
  }

  if (service.readPerm) {
    chosen.push(service.readPerm);
  }
  if (service.writePerm) {
    chosen.push(service.writePerm);
  }
  chosen.push(...service.otherPerms);
}

/**
 * Resolve every available scope to read + write permission groups.
 *
 * @param scopes - All available service groups.
 * @returns Permission groups for a full-access token.
 */
export function resolveFullAccessPermissions(
  scopes: ServiceGroup[]
): PermissionGroup[] {
  const chosen: PermissionGroup[] = [];

  for (const service of scopes) {
    if (service.name === TOKEN_MANAGEMENT_SERVICE) {
      continue;
    }

    appendServicePermissions(
      chosen,
      service,
      service.readPerm && service.writePerm ? "write" : undefined
    );
  }

  return chosen;
}
