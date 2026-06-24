/**
 * @module automation
 *
 * Non-interactive CLI flows: discovery, token creation, and spec handling.
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";

import { getAccounts, getPermissionGroups, getUser } from "#src/api.ts";
import type { CliArgs } from "#src/cli-args.ts";
import { validateNonInteractiveSpec } from "#src/cli-args.ts";
import { createTokenFromSpec } from "#src/create.ts";
import {
  formatAccountsList,
  formatPermissionsList,
  formatScopesList,
} from "#src/discovery.ts";
import type { CloudflareApiError } from "#src/errors.ts";
import { groupByService } from "#src/permissions.ts";
import { askCredentials } from "#src/prompts.ts";
import type { TokenSpec } from "#src/spec.ts";
import { readTokenSpecFromFile } from "#src/spec.ts";
import type {
  Account,
  PermissionGroup,
  ServiceGroup,
  UserInfo,
} from "#src/types.ts";

type ApiError = CloudflareApiError | UnhandledException;

interface AutomationContext {
  accounts: Account[];
  allPerms: PermissionGroup[];
  apiToken: string;
  scopes: ServiceGroup[];
  user: UserInfo;
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

function writeStdout(message: string): void {
  process.stdout.write(message.endsWith("\n") ? message : `${message}\n`);
}

function failAutomation(message: string): never {
  writeStderr(message);
  process.exit(1);
}

async function getApiToken(): Promise<string> {
  const { apiKey } = await askCredentials();
  return apiKey;
}

function formatApiError(error: ApiError): string {
  return matchError(error, {
    CloudflareApiError: (apiError) =>
      `${apiError.message}\n\nYour API token may be incorrect or missing required permissions.`,
    UnhandledException: (exception) => exception.message,
  });
}

async function fetchAutomationContext(
  apiToken: string
): Promise<AutomationContext> {
  const userResult = await getUser(apiToken);
  if (userResult.isErr()) {
    failAutomation(formatApiError(userResult.error));
  }

  const accountsResult = await getAccounts(apiToken);
  if (accountsResult.isErr()) {
    failAutomation(formatApiError(accountsResult.error));
  }

  const permsResult = await getPermissionGroups(apiToken);
  if (permsResult.isErr()) {
    failAutomation(formatApiError(permsResult.error));
  }

  return {
    accounts: accountsResult.value,
    allPerms: permsResult.value,
    apiToken,
    scopes: groupByService(permsResult.value),
    user: userResult.value,
  };
}

function cliArgsToTokenSpec(args: CliArgs): TokenSpec {
  const spec: TokenSpec = {
    dryRun: args.dryRun,
    name: args.name ?? "",
    output: args.output,
  };

  if (args.preset) {
    spec.preset = args.preset;
  }

  if (args.scopes) {
    spec.scopes = args.scopes;
  }

  if (args.accounts) {
    spec.accounts = args.accounts;
  }

  return spec;
}

function resolveTokenSpec(args: CliArgs): Promise<TokenSpec> {
  if (args.file) {
    return readTokenSpecFromFile(args.file);
  }

  return Promise.resolve(cliArgsToTokenSpec(args));
}

export async function runDiscovery(args: CliArgs): Promise<void> {
  const apiToken = await getApiToken();
  const context = await fetchAutomationContext(apiToken);

  if (args.command === "list-scopes") {
    writeStdout(formatScopesList(context.scopes, args.format));
    return;
  }

  if (args.command === "list-permissions") {
    writeStdout(formatPermissionsList(context.allPerms, args.format));
    return;
  }

  writeStdout(formatAccountsList(context.accounts, args.format));
}

export async function runAutomationCreate(args: CliArgs): Promise<void> {
  const validationError = validateNonInteractiveSpec(args);
  if (validationError && !args.file) {
    failAutomation(validationError);
  }

  const spec = await resolveTokenSpec(args);
  if (args.dryRun) {
    spec.dryRun = true;
  }

  const apiToken = await getApiToken();
  const context = await fetchAutomationContext(apiToken);

  const result = await createTokenFromSpec(spec, context);

  if (result.isErr()) {
    failAutomation(
      matchError(result.error, {
        CloudflareApiError: (error) => formatApiError(error),
        CreateFlowError: (error) => error.message,
        RestrictedPermissionError: (error) =>
          `Restricted permission: ${error.permissionName}`,
        ScopeSpecError: (error) => error.message,
        TokenCreationError: (error) =>
          `Error creating token:\n${error.errorText}`,
        TokenSpecError: (error) => error.message,
        UnhandledException: (error) => error.message,
      })
    );
  }

  const { excludedPermissions, policies, token } = result.value;

  if (spec.dryRun) {
    writeStdout(`${JSON.stringify({ policies }, null, 2)}\n`);
    return;
  }

  if (excludedPermissions.length > 0) {
    writeStderr(
      `Excluded ${excludedPermissions.length} restricted permissions:\n${excludedPermissions.map((name) => `  - ${name}`).join("\n")}`
    );
  }

  if (spec.output === "json" && token) {
    writeStdout(
      `${JSON.stringify({ id: token.id, name: token.name, value: token.value })}\n`
    );
    return;
  }

  if (token) {
    writeStdout(`Token created: ${token.name}\n${token.value}\n`);
  }
}

export function shouldRunAutomation(args: CliArgs): boolean {
  if (
    args.command === "list-scopes" ||
    args.command === "list-permissions" ||
    args.command === "list-accounts"
  ) {
    return true;
  }

  if (args.command === "create") {
    return true;
  }

  if (
    args.nonInteractive &&
    (args.name || args.preset || args.scopes || args.file || args.dryRun)
  ) {
    return true;
  }

  return false;
}

export function failIfNonInteractiveIncomplete(args: CliArgs): void {
  if (process.stdin.isTTY === true) {
    return;
  }

  if (shouldRunAutomation(args) && args.command !== "interactive") {
    if (args.command === "create" || args.nonInteractive) {
      const validationError = validateNonInteractiveSpec(args);
      if (validationError && !args.file) {
        failAutomation(
          `${validationError}\n\nRun create-cf-token --help automation for usage.`
        );
      }
    }
    return;
  }

  if (args.command === "interactive") {
    failAutomation(
      "stdin is not a TTY and no automation flags were provided.\n\nProvide a complete token spec with -n/--non-interactive, or use discovery flags (--list-scopes, --list-accounts, --list-permissions).\n\nRun create-cf-token --help automation for usage."
    );
  }
}
