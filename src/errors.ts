import { TaggedError } from "better-result";

export class CloudflareApiError extends TaggedError("CloudflareApiError")<{
  path: string;
  messages: string[];
  message: string;
}>() {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}

export class TokenCreationError extends TaggedError("TokenCreationError")<{
  errorText: string;
  message: string;
}>() {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token creation failed: ${args.errorText}`,
    });
  }
}

export class TokenDeletionError extends TaggedError("TokenDeletionError")<{
  errorText: string;
  message: string;
}>() {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}

export class RestrictedPermissionError extends TaggedError(
  "RestrictedPermissionError"
)<{
  permissionName: string;
  errorText: string;
  message: string;
}>() {
  constructor(args: { permissionName: string; errorText: string }) {
    super({
      ...args,
      message: `Restricted permission: ${args.permissionName}`,
    });
  }
}
