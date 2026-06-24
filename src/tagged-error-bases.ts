/**
 * @module tagged-error-bases
 *
 * Internal TaggedError base classes shared across exported modules.
 */

import { TaggedError as createTaggedError } from "better-result";
import type { TaggedErrorClass } from "better-result";

interface CloudflareApiErrorProps extends Record<string, unknown> {
  path: string;
  messages: string[];
  message: string;
}

export const CloudflareApiErrorBase: TaggedErrorClass<
  "CloudflareApiError",
  CloudflareApiErrorProps
> = createTaggedError("CloudflareApiError")<CloudflareApiErrorProps>();

interface TokenCreationErrorProps extends Record<string, unknown> {
  errorText: string;
  message: string;
}

export const TokenCreationErrorBase: TaggedErrorClass<
  "TokenCreationError",
  TokenCreationErrorProps
> = createTaggedError("TokenCreationError")<TokenCreationErrorProps>();

interface TokenDeletionErrorProps extends Record<string, unknown> {
  errorText: string;
  message: string;
}

export const TokenDeletionErrorBase: TaggedErrorClass<
  "TokenDeletionError",
  TokenDeletionErrorProps
> = createTaggedError("TokenDeletionError")<TokenDeletionErrorProps>();

interface RestrictedPermissionErrorProps extends Record<string, unknown> {
  permissionName: string;
  errorText: string;
  message: string;
}

export const RestrictedPermissionErrorBase: TaggedErrorClass<
  "RestrictedPermissionError",
  RestrictedPermissionErrorProps
> = createTaggedError(
  "RestrictedPermissionError"
)<RestrictedPermissionErrorProps>();

interface ScopeSpecErrorProps extends Record<string, unknown> {
  message: string;
}

export const ScopeSpecErrorBase: TaggedErrorClass<
  "ScopeSpecError",
  ScopeSpecErrorProps
> = createTaggedError("ScopeSpecError")<ScopeSpecErrorProps>();

interface TokenSpecErrorProps extends Record<string, unknown> {
  message: string;
}

export const TokenSpecErrorBase: TaggedErrorClass<
  "TokenSpecError",
  TokenSpecErrorProps
> = createTaggedError("TokenSpecError")<TokenSpecErrorProps>();

interface CreateFlowErrorProps extends Record<string, unknown> {
  message: string;
}

export const CreateFlowErrorBase: TaggedErrorClass<
  "CreateFlowError",
  CreateFlowErrorProps
> = createTaggedError("CreateFlowError")<CreateFlowErrorProps>();

interface TokenCreationFlowErrorProps extends Record<string, unknown> {
  message: string;
}

export const TokenCreationFlowErrorBase: TaggedErrorClass<
  "TokenCreationFlowError",
  TokenCreationFlowErrorProps
> = createTaggedError("TokenCreationFlowError")<TokenCreationFlowErrorProps>();

interface TokenDeletionFlowErrorProps extends Record<string, unknown> {
  message: string;
}

export const TokenDeletionFlowErrorBase: TaggedErrorClass<
  "TokenDeletionFlowError",
  TokenDeletionFlowErrorProps
> = createTaggedError("TokenDeletionFlowError")<TokenDeletionFlowErrorProps>();
