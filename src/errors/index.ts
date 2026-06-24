/**
 * @module errors
 *
 * Published API error types for `create-cf-token/errors`. Returned as `Result` errors from
 * the API client — never thrown at library boundaries.
 */

export { CloudflareApiError } from "@/errors/cloudflare-api-error.ts";
export { RestrictedPermissionError } from "@/errors/restricted-permission-error.ts";
export { TokenCreationError } from "@/errors/token-creation-error.ts";
export { TokenDeletionError } from "@/errors/token-deletion-error.ts";
