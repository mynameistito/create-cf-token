/**
 * @module errors/bases
 *
 * Internal {@link https://github.com/supermacro/better-result | better-result} `TaggedErrorClass`
 * factories. Each exported error file extends one base so `_tag` discrimination and `matchError`
 * stay consistent across API, automation, and interactive flows.
 *
 * Hierarchy:
 * - {@link CloudflareApiErrorBase} — generic REST envelope failures (any path).
 * - {@link TokenCreationErrorBase} / {@link TokenDeletionErrorBase} — token lifecycle endpoints.
 * - {@link RestrictedPermissionErrorBase} — restricted permission on create; callers retry with exclusions.
 * - {@link ScopeSpecErrorBase} / {@link TokenSpecErrorBase} / {@link CreateFlowErrorBase} — automation spec parsing.
 * - {@link TokenCreationFlowErrorBase} / {@link TokenDeletionFlowErrorBase} — interactive CLI flow failures.
 */

import { TaggedError as createTaggedError } from "better-result";
import type { TaggedErrorClass } from "better-result";

interface CloudflareApiErrorProps extends Record<string, unknown> {
  path: string;
  messages: string[];
  message: string;
}

/** Base for HTTP / JSON envelope failures on Cloudflare REST paths. */
export const CloudflareApiErrorBase: TaggedErrorClass<
  "CloudflareApiError",
  CloudflareApiErrorProps
> = createTaggedError("CloudflareApiError")<CloudflareApiErrorProps>();

interface TokenCreationErrorProps extends Record<string, unknown> {
  errorText: string;
  message: string;
}

/** Base for non-restricted failures from `POST /user/tokens`. */
export const TokenCreationErrorBase: TaggedErrorClass<
  "TokenCreationError",
  TokenCreationErrorProps
> = createTaggedError("TokenCreationError")<TokenCreationErrorProps>();

interface TokenDeletionErrorProps extends Record<string, unknown> {
  errorText: string;
  message: string;
}

/** Base for failures from `DELETE /user/tokens/:id`. */
export const TokenDeletionErrorBase: TaggedErrorClass<
  "TokenDeletionError",
  TokenDeletionErrorProps
> = createTaggedError("TokenDeletionError")<TokenDeletionErrorProps>();

interface RestrictedPermissionErrorProps extends Record<string, unknown> {
  permissionName: string;
  errorText: string;
  message: string;
}

/** Base for restricted-permission rejections on token create; carries `permissionName` for retry exclusion. */
export const RestrictedPermissionErrorBase: TaggedErrorClass<
  "RestrictedPermissionError",
  RestrictedPermissionErrorProps
> = createTaggedError(
  "RestrictedPermissionError"
)<RestrictedPermissionErrorProps>();

interface ScopeSpecErrorProps extends Record<string, unknown> {
  message: string;
}

/** Base for invalid scope-spec JSON in automation (`create-cf-token/scope-spec`). */
export const ScopeSpecErrorBase: TaggedErrorClass<
  "ScopeSpecError",
  ScopeSpecErrorProps
> = createTaggedError("ScopeSpecError")<ScopeSpecErrorProps>();

interface TokenSpecErrorProps extends Record<string, unknown> {
  message: string;
}

/** Base for invalid token-spec JSON in automation (`create-cf-token/spec`). */
export const TokenSpecErrorBase: TaggedErrorClass<
  "TokenSpecError",
  TokenSpecErrorProps
> = createTaggedError("TokenSpecError")<TokenSpecErrorProps>();

interface CreateFlowErrorProps extends Record<string, unknown> {
  message: string;
}

/** Base for non-interactive create failures in automation (`create-cf-token/create`). */
export const CreateFlowErrorBase: TaggedErrorClass<
  "CreateFlowError",
  CreateFlowErrorProps
> = createTaggedError("CreateFlowError")<CreateFlowErrorProps>();

interface TokenCreationFlowErrorProps extends Record<string, unknown> {
  message: string;
}

/** Base for terminal failures in the interactive token-create flow. */
export const TokenCreationFlowErrorBase: TaggedErrorClass<
  "TokenCreationFlowError",
  TokenCreationFlowErrorProps
> = createTaggedError("TokenCreationFlowError")<TokenCreationFlowErrorProps>();

interface TokenDeletionFlowErrorProps extends Record<string, unknown> {
  message: string;
}

/** Base for terminal failures in the interactive token-delete flow. */
export const TokenDeletionFlowErrorBase: TaggedErrorClass<
  "TokenDeletionFlowError",
  TokenDeletionFlowErrorProps
> = createTaggedError("TokenDeletionFlowError")<TokenDeletionFlowErrorProps>();
