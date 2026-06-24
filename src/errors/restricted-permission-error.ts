import { RestrictedPermissionErrorBase } from "#src/errors/bases.ts";

export class RestrictedPermissionError extends RestrictedPermissionErrorBase {
  constructor(args: { permissionName: string; errorText: string }) {
    super({
      ...args,
      message: `Restricted permission: ${args.permissionName}`,
    });
  }
}
