import { TaggedError } from "better-result";

/**
 * Error returned when a Cloudflare API GET request fails.
 * Wraps the API path and all error messages from the response body.
 */
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

/**
 * Error thrown when token creation fails for a non-restricted-permission reason.
 * Contains the raw error text from the Cloudflare API response.
 */
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

/**
 * Error thrown when token deletion (revocation) fails.
 * Contains the raw error text from the Cloudflare API response.
 */
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

/**
 * Error thrown when the Cloudflare API rejects a permission group as restricted.
 * The retry loop in {@linkcode attemptCreateToken} catches these and excludes
 * the named permission from the next attempt.
 */
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
