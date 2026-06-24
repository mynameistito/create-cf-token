/* oxlint-disable max-classes-per-file -- tagged error subtypes belong in one module */
import { TaggedError as createTaggedError } from "better-result";

const CloudflareApiErrorBase = createTaggedError("CloudflareApiError")<{
  path: string;
  messages: string[];
  message: string;
}>();

export class CloudflareApiError extends CloudflareApiErrorBase {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}

const TokenCreationErrorBase = createTaggedError("TokenCreationError")<{
  errorText: string;
  message: string;
}>();

export class TokenCreationError extends TokenCreationErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token creation failed: ${args.errorText}`,
    });
  }
}

const TokenDeletionErrorBase = createTaggedError("TokenDeletionError")<{
  errorText: string;
  message: string;
}>();

export class TokenDeletionError extends TokenDeletionErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}

const RestrictedPermissionErrorBase = createTaggedError(
  "RestrictedPermissionError"
)<{
  permissionName: string;
  errorText: string;
  message: string;
}>();

export class RestrictedPermissionError extends RestrictedPermissionErrorBase {
  constructor(args: { permissionName: string; errorText: string }) {
    super({
      ...args,
      message: `Restricted permission: ${args.permissionName}`,
    });
  }
}
