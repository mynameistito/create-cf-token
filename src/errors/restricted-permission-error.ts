import { RestrictedPermissionErrorBase } from "@/errors/bases.ts";

/**
 * Error returned when `POST /user/tokens` rejects a permission the caller cannot grant.
 * Interactive flows add `permissionName` to an exclusion set and retry (up to 50 attempts).
 */
export class RestrictedPermissionError extends RestrictedPermissionErrorBase {
  constructor(args: { permissionName: string; errorText: string }) {
    super({
      ...args,
      message: `Restricted permission: ${args.permissionName}`,
    });
  }
}
