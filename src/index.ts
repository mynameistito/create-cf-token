/**
 * Interactive CLI orchestrator for create-cf-token.
 *
 * Verifies credentials, fetches accounts and permission groups, then runs the
 * interactive token-creation session loop. Re-exports policy and CLI flag helpers
 * for the published library surface.
 *
 * @module index
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";

import { getAccounts, getPermissionGroups, getUser } from "@/api/client.ts";
import type { CloudflareApiError } from "@/errors/index.ts";
import {
  deleteTokens,
  TokenCreationFlowError,
  TokenDeletionFlowError,
  tokenCreateFlow,
} from "@/flows/interactive-create.ts";
import { groupByService } from "@/permissions/group.ts";
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
  isPromptCancel,
  logMessage,
  printNote,
} from "@/prompts/index.ts";
import colour from "@/terminal/colour.ts";
import type { Account, CreatedToken } from "@/types/index.ts";

export { buildPolicies } from "@/policies/build.ts";
export {
  handleFlags,
  handleSkillFlag,
  parseArgv,
  runAutomationIfNeeded,
} from "@/cli/flags.ts";
export type { ParsedCli } from "@/cli/flags.ts";

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

/**
 * Map a Cloudflare API or unhandled error to a user-facing cancel message and exit.
 *
 * @param error - API failure or unexpected exception from credential verification or fetch calls.
 * @param deps - Optional dependency overrides (primarily for tests).
 */
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

/**
 * Handle top-level CLI failures: silent exit on prompt cancel, otherwise log and exit 1.
 *
 * @param err - Thrown value from the interactive flow or orchestrator.
 */
export function handleCliError(err: unknown): never {
  if (isPromptCancel(err)) {
    process.exit(0);
  }

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
  apiToken: string,
  s: ReturnType<typeof createSpinner>,
  deps: IndexDeps,
  previousToken?: CreatedToken
): Promise<void> {
  let pendingPrevious = previousToken;

  // Sequential interactive post-create loop — each iteration waits for user input.
  /* eslint-disable no-await-in-loop */
  while (true) {
    const createdToken = await deps.tokenCreateFlow(
      accounts,
      scopes,
      userId,
      apiToken,
      s
    );

    if (pendingPrevious) {
      await deps.deleteTokens([pendingPrevious], apiToken, s);
    }

    const action = await deps.askPostCreateAction();

    if (action === "revoke-done") {
      await deps.deleteTokens([createdToken], apiToken, s);
      return;
    }

    if (action === "revoke-again") {
      pendingPrevious = createdToken;
      continue;
    }

    if (action === "again") {
      pendingPrevious = undefined;
      continue;
    }

    return;
  }
  /* eslint-enable no-await-in-loop */
}

/**
 * Run the full interactive token-creation session.
 *
 * Prompts for credentials, verifies the parent token, loads accounts and scopes,
 * then delegates to {@link tokenCreateFlow} in a post-create loop until the user exits.
 *
 * @param deps - Optional dependency overrides (primarily for tests).
 * @returns Resolves when the user finishes or a flow error sets a non-zero exit code.
 */
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

  const { apiToken } = await deps.askCredentials();

  const s = deps.createSpinner();

  s.start("Verifying token...");
  const userResult = await deps.getUser(apiToken);
  if (userResult.isErr()) {
    s.stop("Failed");
    handleApiError(userResult.error, deps);
  }
  const user = userResult.value;
  s.stop(`Authenticated as ${user.email}`);

  s.start("Fetching accounts...");
  const accountsResult = await deps.getAccounts(apiToken);
  if (accountsResult.isErr()) {
    s.stop("Failed");
    handleApiError(accountsResult.error, deps);
  }
  const accounts = accountsResult.value;
  s.stop(`Found ${accounts.length} account(s)`);

  s.start("Fetching permission groups...");
  const permsResult = await deps.getPermissionGroups(apiToken);
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
    await runCreateSession(accounts, scopes, user.id, apiToken, s, deps);
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
