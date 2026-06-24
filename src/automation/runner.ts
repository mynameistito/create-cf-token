/**
 * @module automation/runner
 *
 * Non-interactive CLI flows: discovery, token creation, and spec handling.
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";

import { getAccounts, getPermissionGroups, getUser } from "@/api/client.ts";
import { createTokenFromSpec } from "@/automation/create.ts";
import {
  formatAccountsList,
  formatPermissionsList,
  formatScopesList,
} from "@/automation/discovery.ts";
import type { TokenSpec } from "@/automation/spec.ts";
import { readTokenSpecFromFile, TokenSpecError } from "@/automation/spec.ts";
import type { CliArgs } from "@/cli/args.ts";
import { validateNonInteractiveSpec } from "@/cli/args.ts";
import type { CloudflareApiError } from "@/errors/index.ts";
import { groupByService } from "@/permissions/group.ts";
import { askCredentials } from "@/prompts/index.ts";
import type {
  Account,
  PermissionGroup,
  ServiceGroup,
  UserInfo,
} from "@/types/index.ts";

type ApiError = CloudflareApiError | UnhandledException;

interface AutomationContext {
  accounts: Account[];
  allPerms: PermissionGroup[];
  apiToken: string;
  scopes: ServiceGroup[];
  user: UserInfo;
}

interface AutomationRunnerDeps {
  askCredentials: typeof askCredentials;
  createTokenFromSpec: typeof createTokenFromSpec;
  getAccounts: typeof getAccounts;
  getPermissionGroups: typeof getPermissionGroups;
  getUser: typeof getUser;
  writeStderr: (message: string) => void;
  writeStdout: (message: string) => void;
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

function writeStdout(message: string): void {
  process.stdout.write(message.endsWith("\n") ? message : `${message}\n`);
}

const defaultDeps: AutomationRunnerDeps = {
  askCredentials,
  createTokenFromSpec,
  getAccounts,
  getPermissionGroups,
  getUser,
  writeStderr,
  writeStdout,
};

function failAutomation(message: string, deps: AutomationRunnerDeps): never {
  deps.writeStderr(message);
  process.exit(1);
}

async function getApiToken(deps: AutomationRunnerDeps): Promise<string> {
  const { apiToken } = await deps.askCredentials();
  return apiToken;
}

function formatApiError(error: ApiError): string {
  return matchError(error, {
    CloudflareApiError: (apiError) =>
      `${apiError.message}\n\nYour API token may be incorrect or missing required permissions.`,
    UnhandledException: (exception) => exception.message,
  });
}

async function fetchAutomationContext(
  apiToken: string,
  deps: AutomationRunnerDeps
): Promise<AutomationContext> {
  const userResult = await deps.getUser(apiToken);
  if (userResult.isErr()) {
    failAutomation(formatApiError(userResult.error), deps);
  }

  const accountsResult = await deps.getAccounts(apiToken);
  if (accountsResult.isErr()) {
    failAutomation(formatApiError(accountsResult.error), deps);
  }

  const permsResult = await deps.getPermissionGroups(apiToken);
  if (permsResult.isErr()) {
    failAutomation(formatApiError(permsResult.error), deps);
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

export async function runDiscovery(
  args: CliArgs,
  deps: AutomationRunnerDeps = defaultDeps
): Promise<void> {
  const apiToken = await getApiToken(deps);
  const context = await fetchAutomationContext(apiToken, deps);

  if (args.command === "list-scopes") {
    deps.writeStdout(formatScopesList(context.scopes, args.format));
    return;
  }

  if (args.command === "list-permissions") {
    deps.writeStdout(formatPermissionsList(context.allPerms, args.format));
    return;
  }

  deps.writeStdout(formatAccountsList(context.accounts, args.format));
}

export async function runAutomationCreate(
  args: CliArgs,
  deps: AutomationRunnerDeps = defaultDeps
): Promise<void> {
  const validationError = validateNonInteractiveSpec(args);
  if (validationError && !args.file) {
    failAutomation(validationError, deps);
  }

  let spec: TokenSpec;
  try {
    spec = await resolveTokenSpec(args);
  } catch (error) {
    if (TokenSpecError.is(error)) {
      failAutomation(error.message, deps);
    }
    throw error;
  }
  if (args.dryRun) {
    spec.dryRun = true;
  }
  if (args.output) {
    spec.output = args.output;
  }

  const apiToken = await getApiToken(deps);
  const context = await fetchAutomationContext(apiToken, deps);

  const result = await deps.createTokenFromSpec(spec, context);

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
      }),
      deps
    );
  }

  const { excludedPermissions, policies, token } = result.value;

  if (spec.dryRun) {
    deps.writeStdout(`${JSON.stringify({ policies }, null, 2)}\n`);
    return;
  }

  if (excludedPermissions.length > 0) {
    deps.writeStderr(
      `Excluded ${excludedPermissions.length} restricted permissions:\n${excludedPermissions.map((name) => `  - ${name}`).join("\n")}`
    );
  }

  if (spec.output === "json" && token) {
    deps.writeStdout(
      `${JSON.stringify({ id: token.id, name: token.name, value: token.value })}\n`
    );
    return;
  }

  if (token) {
    deps.writeStdout(`Token created: ${token.name}\n${token.value}\n`);
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

  if (args.explicitNonInteractive) {
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

function failIncompleteNonInteractiveSpec(args: CliArgs): void {
  const validationError = validateNonInteractiveSpec(args);
  if (validationError && !args.file) {
    failAutomation(
      `${validationError}\n\nRun create-cf-token --help automation for usage.`,
      defaultDeps
    );
  }
}

function isDiscoveryCommand(command: CliArgs["command"]): boolean {
  return (
    command === "list-scopes" ||
    command === "list-permissions" ||
    command === "list-accounts"
  );
}

export function failIfNonInteractiveIncomplete(args: CliArgs): void {
  if (process.stdin.isTTY === true) {
    if (args.explicitNonInteractive && !isDiscoveryCommand(args.command)) {
      failIncompleteNonInteractiveSpec(args);
    }
    return;
  }

  if (shouldRunAutomation(args)) {
    if (
      !isDiscoveryCommand(args.command) &&
      (args.command === "create" || args.explicitNonInteractive)
    ) {
      failIncompleteNonInteractiveSpec(args);
    }
    return;
  }

  if (args.command === "interactive") {
    failAutomation(
      "stdin is not a TTY and no automation flags were provided.\n\nProvide a complete token spec with -n/--non-interactive, or use discovery flags (--list-scopes, --list-accounts, --list-permissions).\n\nRun create-cf-token --help automation for usage.",
      defaultDeps
    );
  }
}
