/**
 * @module automation/spec
 *
 * Token spec types and JSON parsing for non-interactive token creation.
 */

import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { text as streamText } from "node:stream/consumers";

import { TokenSpecErrorBase } from "@/errors/bases.ts";

class TokenSpecError extends TokenSpecErrorBase {}

export type TokenSpecErrorType = InstanceType<typeof TokenSpecError>;

/** Declarative token specification for non-interactive creation. */
export interface TokenSpec {
  accounts?: string | string[];
  dryRun?: boolean;
  name: string;
  output?: "json" | "text";
  preset?: "full-access";
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
    return value.map((item) => item.trim());
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
 * Parse a token spec from a JSON string.
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
 * Read a token spec from a file path or stdin (`-`).
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
