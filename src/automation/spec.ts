/**
 * @module automation/spec
 *
 * Token spec types and JSON parsing for non-interactive token creation.
 */

import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { text as streamText } from "node:stream/consumers";

import { TokenSpecErrorBase } from "@/errors/bases.ts";

/** Thrown when token spec JSON is invalid or fails shape validation. */
class TokenSpecError extends TokenSpecErrorBase {}

/** Instance type of {@linkcode TokenSpecError}. */
export type TokenSpecErrorType = InstanceType<typeof TokenSpecError>;

/**
 * Declarative token specification for non-interactive creation.
 *
 * Requires either `preset: "full-access"` or a `scopes` string (not both).
 * Scoped specs must include `accounts`.
 */
export interface TokenSpec {
  /** Account IDs, `"all"`, or an array of IDs. Required when using `scopes`. */
  accounts?: string | string[];
  /** When true, resolve policies only — do not POST to the API. */
  dryRun?: boolean;
  /** Display name for the created token. */
  name: string;
  /** CLI output format for the created token (ignored by the library create path). */
  output?: "json" | "text";
  /** Grant all scopes at read+write, excluding API token management. */
  preset?: "full-access";
  /** Comma-separated scope spec (see `create-cf-token/scope-spec`). */
  scopes?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccountsField(value: unknown): string | string[] | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new TokenSpecError({
        message: 'Invalid "accounts" field: expected a non-empty string.',
      });
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TokenSpecError({
        message: 'Invalid "accounts" field: array must not be empty.',
      });
    }
    if (!value.every((item) => typeof item === "string")) {
      throw new TokenSpecError({
        message:
          'Invalid "accounts" field: expected a string or array of strings.',
      });
    }
    const trimmed = value.map((item) => item.trim());
    if (trimmed.some((item) => !item)) {
      throw new TokenSpecError({
        message:
          'Invalid "accounts" field: array items must be non-empty strings.',
      });
    }
    return trimmed;
  }

  throw new TokenSpecError({
    message: 'Invalid "accounts" field: expected a string or array of strings.',
  });
}

function parseOptionalFields(
  parsed: Record<string, unknown>,
  spec: TokenSpec
): void {
  if (parsed.preset !== undefined) {
    if (parsed.preset !== "full-access") {
      throw new TokenSpecError({
        message: 'Invalid "preset": only "full-access" is supported.',
      });
    }
    spec.preset = "full-access";
  }

  if (parsed.scopes !== undefined) {
    if (typeof parsed.scopes !== "string" || !parsed.scopes.trim()) {
      throw new TokenSpecError({
        message: 'Invalid "scopes": expected a non-empty string.',
      });
    }
    spec.scopes = parsed.scopes.trim();
  }

  if (parsed.accounts !== undefined) {
    spec.accounts = parseAccountsField(parsed.accounts);
  }

  if (parsed.dryRun !== undefined) {
    if (typeof parsed.dryRun !== "boolean") {
      throw new TokenSpecError({
        message: 'Invalid "dryRun": expected a boolean.',
      });
    }
    spec.dryRun = parsed.dryRun;
  }

  if (parsed.output !== undefined) {
    if (parsed.output !== "json" && parsed.output !== "text") {
      throw new TokenSpecError({
        message: 'Invalid "output": expected "json" or "text".',
      });
    }
    spec.output = parsed.output;
  }
}

function validateTokenSpecShape(spec: TokenSpec): void {
  if (spec.preset && spec.scopes) {
    throw new TokenSpecError({
      message:
        'Token spec cannot include both "preset" and "scopes". Use one or the other.',
    });
  }

  if (!spec.preset && !spec.scopes) {
    throw new TokenSpecError({
      message:
        'Token spec requires either "preset": "full-access" or a "scopes" string.',
    });
  }

  if (spec.scopes && !spec.preset && !spec.accounts) {
    throw new TokenSpecError({
      message:
        'Token spec with "scopes" requires an "accounts" field (string or array).',
    });
  }
}

/**
 * Parse and validate a token spec from a JSON string.
 *
 * @param json - Raw JSON object with at least a `name` field and either `preset` or `scopes`.
 * @returns A validated {@linkcode TokenSpec}.
 * @throws {TokenSpecError} When JSON is malformed or fields fail validation.
 */
export function parseTokenSpecJson(json: string): TokenSpec {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new TokenSpecError({ message: "Invalid JSON in token spec." });
  }

  if (!isRecord(parsed)) {
    throw new TokenSpecError({
      message: "Token spec must be a JSON object.",
    });
  }

  if (typeof parsed.name !== "string" || !parsed.name.trim()) {
    throw new TokenSpecError({
      message: 'Token spec requires a non-empty "name" field.',
    });
  }

  const spec: TokenSpec = { name: parsed.name.trim() };
  parseOptionalFields(parsed, spec);
  validateTokenSpecShape(spec);

  return spec;
}

/**
 * Read and parse a token spec from a file path or stdin.
 *
 * @param filePath - Filesystem path, or `"-"` to read from stdin.
 * @returns A validated {@linkcode TokenSpec}.
 * @throws {TokenSpecError} When the file is missing or contents fail validation.
 */
export async function readTokenSpecFromFile(
  filePath: string
): Promise<TokenSpec> {
  const content =
    filePath === "-"
      ? await streamText(stdin)
      : await readFile(filePath, "utf-8").catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
              throw new TokenSpecError({
                message: `Token spec file not found: ${filePath}`,
              });
            }
            throw error;
          }
        );

  return parseTokenSpecJson(content);
}

/**
 * Normalize accounts from CLI args or token spec to a comma-separated string.
 *
 * @param accounts - A single account specifier, an array of IDs, or `undefined`.
 * @returns Comma-separated account IDs, or `undefined` when input is absent.
 */
export function normalizeAccountsInput(
  accounts: string | string[] | undefined
): string | undefined {
  if (!accounts) {
    return undefined;
  }

  if (Array.isArray(accounts)) {
    return accounts.join(",");
  }

  return accounts;
}

export { TokenSpecError };
