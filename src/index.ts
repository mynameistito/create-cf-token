/**
 * @module index
 *
 * CLI orchestrator for the create-cf-token tool.
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";

import { getAccounts, getPermissionGroups, getUser } from "#src/api/client.ts";
import type { CloudflareApiError } from "#src/errors/index.ts";
import {
  deleteTokens,
  TokenCreationFlowError,
  TokenDeletionFlowError,
  tokenCreateFlow,
} from "#src/flows/interactive-create.ts";
import { groupByService } from "#src/permissions/group.ts";
import {
  askCredentials,
  askPostCreateAction,
  buildAuthTemplateUrl,
  CF_API_TOKENS_URL,
  CF_AUTH_TEMPLATE_URL,
  cancelPrompt,
  createSpinner,
  finishOutro,
  hyperlinkUrl,
  logMessage,
  printNote,
} from "#src/prompts/index.ts";
import colour from "#src/terminal/colour.ts";
import type { Account, CreatedToken } from "#src/types/index.ts";

export { buildPolicies } from "#src/policies/build.ts";
export {
  handleFlags,
  handleSkillFlag,
  parseArgv,
  runAutomationIfNeeded,
} from "#src/cli/flags.ts";
export type { ParsedCli } from "#src/cli/flags.ts";

type ApiError = CloudflareApiError | UnhandledException;

interface IndexDeps {
  askCredentials: typeof askCredentials;
  askPostCreateAction: typeof askPostCreateAction;
  buildAuthTemplateUrl: typeof buildAuthTemplateUrl;
  cancelPrompt: typeof cancelPrompt;
  createSpinner: typeof createSpinner;
  deleteTokens: typeof deleteTokens;
  finishOutro: typeof finishOutro;
  getAccounts: typeof getAccounts;
  getPermissionGroups: typeof getPermissionGroups;
  getUser: typeof getUser;
  hyperlinkUrl: typeof hyperlinkUrl;
  logMessage: typeof logMessage;
  printNote: typeof printNote;
  tokenCreateFlow: typeof tokenCreateFlow;
}

const defaultDeps: IndexDeps = {
  askCredentials,
  askPostCreateAction,
  buildAuthTemplateUrl,
  cancelPrompt,
  createSpinner,
  deleteTokens,
  finishOutro,
  getAccounts,
  getPermissionGroups,
  getUser,
  hyperlinkUrl,
  logMessage,
  printNote,
  tokenCreateFlow,
};

export function handleApiError(
  error: ApiError,
  deps: IndexDeps = defaultDeps
): never {
  matchError(error, {
    CloudflareApiError: (e) => {
      deps.cancelPrompt(
        `${e.message}\n\nYour API token may be incorrect or missing required permissions.\nManage your tokens: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
      );
    },
    UnhandledException: (e) => deps.cancelPrompt(e.message),
  });
  process.exit(1);
}

export function handleCliError(err: unknown): never {
  if (err instanceof Error) {
    logMessage.error(err.stack ?? err.message);
  } else {
    try {
      const stringified = JSON.stringify(err);
      logMessage.error(stringified === undefined ? String(err) : stringified);
    } catch {
      logMessage.error(String(err));
    }
  }
  process.exit(1);
}

async function runCreateSession(
  accounts: Account[],
  scopes: ReturnType<typeof groupByService>,
  userId: string,
  apiKey: string,
  s: ReturnType<typeof createSpinner>,
  deps: IndexDeps,
  previousToken?: CreatedToken
): Promise<void> {
  const createdToken = await deps.tokenCreateFlow(
    accounts,
    scopes,
    userId,
    apiKey,
    s
  );

  if (previousToken) {
    await deps.deleteTokens([previousToken], apiKey, s);
  }

  const action = await deps.askPostCreateAction();

  if (action === "revoke-done") {
    await deps.deleteTokens([createdToken], apiKey, s);
    return;
  }

  if (action === "revoke-again") {
    await runCreateSession(
      accounts,
      scopes,
      userId,
      apiKey,
      s,
      deps,
      createdToken
    );
    return;
  }

  if (action === "again") {
    await runCreateSession(accounts, scopes, userId, apiKey, s, deps);
  }
}

export async function main(deps: IndexDeps = defaultDeps): Promise<void> {
  deps.printNote(
    [
      `${colour.DIM}A CLI tool for creating ${colour.WHITE}Cloudflare API Tokens${colour.RESET}${colour.DIM} with interactive, guided prompts.`,
      "",
      `${colour.DIM}You'll need a ${colour.WHITE}scoped API Token${colour.RESET}${colour.DIM} with ${colour.WHITE}User Details:Read${colour.RESET}${colour.DIM}, ${colour.WHITE}User API Tokens:Edit${colour.RESET}${colour.DIM}, and ${colour.WHITE}Account Settings:Read${colour.RESET}${colour.DIM} permissions.`,
      `${colour.DIM}Create one here: ${colour.CYAN}${deps.hyperlinkUrl(CF_AUTH_TEMPLATE_URL)}${colour.RESET}`,
    ].join("\n"),
    "create-cf-token"
  );

  const { apiKey } = await deps.askCredentials();

  const s = deps.createSpinner();

  s.start("Verifying token...");
  const userResult = await deps.getUser(apiKey);
  if (userResult.isErr()) {
    s.stop("Failed");
    handleApiError(userResult.error, deps);
  }
  const user = userResult.value;
  s.stop(`Authenticated as ${user.email}`);

  s.start("Fetching accounts...");
  const accountsResult = await deps.getAccounts(apiKey);
  if (accountsResult.isErr()) {
    s.stop("Failed");
    handleApiError(accountsResult.error, deps);
  }
  const accounts = accountsResult.value;
  s.stop(`Found ${accounts.length} account(s)`);

  s.start("Fetching permission groups...");
  const permsResult = await deps.getPermissionGroups(apiKey);
  if (permsResult.isErr()) {
    s.stop("Failed");
    handleApiError(permsResult.error, deps);
  }
  const allPerms = permsResult.value;
  const scopes = groupByService(allPerms);
  s.stop(
    `Found ${scopes.length} scopes (${allPerms.length} permission groups)`
  );

  const authUrl = deps.buildAuthTemplateUrl(allPerms);
  if (authUrl) {
    deps.logMessage.info(
      `Auth token setup URL: ${colour.CYAN}${deps.hyperlinkUrl(authUrl)}${colour.RESET}`
    );
  }

  try {
    await runCreateSession(accounts, scopes, user.id, apiKey, s, deps);
  } catch (error) {
    if (TokenCreationFlowError.is(error) || TokenDeletionFlowError.is(error)) {
      matchError(error, {
        TokenCreationFlowError: (e) => deps.logMessage.error(e.message),
        TokenDeletionFlowError: (e) => deps.logMessage.error(e.message),
      });
      process.exitCode = 1;
      return;
    }

    throw error;
  }

  deps.finishOutro("Done!");
}
