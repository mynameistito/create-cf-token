/* oxlint-disable max-classes-per-file -- tagged error subtypes belong in one module */
import {
  CloudflareApiErrorBase,
  RestrictedPermissionErrorBase,
  TokenCreationErrorBase,
  TokenDeletionErrorBase,
} from "#src/tagged-error-bases.ts";

export class CloudflareApiError extends CloudflareApiErrorBase {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}

export class TokenCreationError extends TokenCreationErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token creation failed: ${args.errorText}`,
    });
  }
}

export class TokenDeletionError extends TokenDeletionErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}

export class RestrictedPermissionError extends RestrictedPermissionErrorBase {
  constructor(args: { permissionName: string; errorText: string }) {
    super({
      ...args,
      message: `Restricted permission: ${args.permissionName}`,
    });
  }
}
