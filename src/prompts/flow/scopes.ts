import {
  appendServicePermissions,
  shouldUseBulkAccessLevel,
} from "#src/permissions/resolve.ts";
import type { AccessLevel } from "#src/permissions/resolve.ts";
import { searchMultiselect } from "#src/prompts/primitives/search-multiselect.ts";
import { selectWithBack } from "#src/prompts/primitives/select-with-back.ts";
import type { Backable, SearchOption } from "#src/prompts/types.ts";
import { GO_BACK } from "#src/prompts/types.ts";
import type { PermissionGroup, ServiceGroup } from "#src/types.ts";

/**
 * Convert an array of service groups into selectable search options.
 * Each option's hint includes the available access levels and scope labels.
 *
 * @param scopes - Service groups to present as options.
 * @returns Options suitable for {@linkcode searchMultiselect}.
 */
function buildScopeOptions(scopes: ServiceGroup[]): SearchOption[] {
  return scopes.map((service) => {
    const levels = service.perms.map(
      (permissionGroup) =>
        permissionGroup.name.replace(service.name, "").trim() ||
        permissionGroup.name
    );
    const scopeLabels = service.scopes.map((scope) => scope.split(".").pop());
    const fullScope = service.scopes.join(" ");

    return {
      fullScope,
      hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
      label: service.name,
      value: service.name,
    };
  });
}

/**
 * For each selected scope, resolve its concrete permission groups.
 *
 * When a service has both read and write permissions, a sub-prompt asks the
 * user to choose the access level. Edit-class permissions in `otherPerms` are
 * included only when the user selects read + write.
 *
 * When every scope is selected, a single bulk access-level prompt is shown
 * instead of one prompt per service.
 *
 * @param scopes - All available service groups.
 * @param selected - Names of scopes the user checked in the multi-select.
 * @param reselectScopes - Re-runs scope selection when the user backs out of an access-level prompt.
 * @param selectAccessLevel - Optional override for access-level prompts (used in unit tests).
 * @returns The resolved permission groups, or {@linkcode GO_BACK} if the user navigated back.
 */
export function buildPermissionsForSelection(
  scopes: ServiceGroup[],
  selected: string[],
  reselectScopes: () => Promise<Backable<PermissionGroup[]>>,
  selectAccessLevel?: (service: ServiceGroup) => Promise<Backable<AccessLevel>>
): Promise<Backable<PermissionGroup[]>> {
  const chosen: PermissionGroup[] = [];

  async function resolveBulkAccessLevel(): Promise<Backable<AccessLevel>> {
    const templateService =
      scopes.find((scope) => scope.readPerm && scope.writePerm) ?? scopes[0];

    if (!templateService) {
      return "read";
    }

    if (selectAccessLevel) {
      return await selectAccessLevel(templateService);
    }

    const level = await selectWithBack("All scopes — access level", [
      { label: "Read only", value: "read" },
      { label: "Read + Write", value: "write" },
    ]);

    return level === GO_BACK ? GO_BACK : (level as AccessLevel);
  }

  async function collect(index: number): Promise<Backable<PermissionGroup[]>> {
    if (index === 0 && shouldUseBulkAccessLevel(scopes, selected)) {
      const level = await resolveBulkAccessLevel();

      if (level === GO_BACK) {
        return reselectScopes();
      }

      for (const scopeName of selected) {
        const service = scopes.find((scope) => scope.name === scopeName);

        if (service) {
          appendServicePermissions(
            chosen,
            service,
            service.readPerm && service.writePerm ? level : undefined
          );
        }
      }

      return chosen;
    }

    const scopeName = selected[index];
    if (scopeName === undefined) {
      return chosen;
    }

    const service = scopes.find((scope) => scope.name === scopeName);

    if (!service) {
      return collect(index + 1);
    }

    if (!(service.readPerm && service.writePerm)) {
      appendServicePermissions(chosen, service);
      return collect(index + 1);
    }

    const level = selectAccessLevel
      ? await selectAccessLevel(service)
      : ((await selectWithBack(`${service.name} — access level`, [
          { label: "Read only", value: "read" },
          { label: "Read + Write", value: "write" },
        ])) as Backable<AccessLevel>);

    if (level === GO_BACK) {
      return reselectScopes();
    }

    appendServicePermissions(chosen, service, level);
    return collect(index + 1);
  }

  return collect(0);
}

async function pickScopesAndBuildPermissions(
  scopes: ServiceGroup[]
): Promise<Backable<PermissionGroup[]>> {
  const selected = await searchMultiselect(
    "Select scopes",
    buildScopeOptions(scopes),
    true
  );

  if (selected === GO_BACK) {
    return GO_BACK;
  }

  return buildPermissionsForSelection(scopes, selected, () =>
    pickScopesAndBuildPermissions(scopes)
  );
}

/**
 * Prompt the user to select permission scopes and resolve them to concrete
 * permission groups. Supports back-navigation: if the user presses Backspace
 * during the access-level sub-prompt, they return to the scope selection.
 *
 * @param scopes - All available service groups.
 * @returns The chosen permission groups, or {@linkcode GO_BACK}.
 */
export function selectScopes(
  scopes: ServiceGroup[]
): Promise<Backable<PermissionGroup[]>> {
  return pickScopesAndBuildPermissions(scopes);
}
