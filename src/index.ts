/**
 * @module index
 *
 * CLI orchestrator for the create-cf-token tool.
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";

import { getAccounts, getPermissionGroups, getUser } from "#src/api.ts";
import colour from "#src/colour.ts";
import type { CloudflareApiError } from "#src/errors.ts";
import {
  deleteTokens,
  TokenCreationFlowError,
  TokenDeletionFlowError,
  tokenCreateFlow,
} from "#src/flows/interactive-create.ts";
import { groupByService } from "#src/permissions.ts";
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
import type { Account, CreatedToken } from "#src/types.ts";

export { buildPolicies } from "#src/policies.ts";
export {
  handleFlags,
  handleSkillFlag,
  parseArgv,
  runAutomationIfNeeded,
} from "#src/cli/flags.ts";
export type { ParsedCli } from "#src/cli/flags.ts";

type ApiError = CloudflareApiError | UnhandledException;

export function handleApiError(error: ApiError): never {
  matchError(error, {
    CloudflareApiError: (e) => {
      cancelPrompt(
        `${e.message}\n\nYour API token may be incorrect or missing required permissions.\nManage your tokens: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
      );
    },
    UnhandledException: (e) => cancelPrompt(e.message),
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
  previousToken?: CreatedToken
): Promise<void> {
  const createdToken = await tokenCreateFlow(
    accounts,
    scopes,
    userId,
    apiKey,
    s
  );

  if (previousToken) {
    await deleteTokens([previousToken], apiKey, s);
  }

  const action = await askPostCreateAction();

  if (action === "revoke-done") {
    await deleteTokens([createdToken], apiKey, s);
    return;
  }

  if (action === "revoke-again") {
    await runCreateSession(accounts, scopes, userId, apiKey, s, createdToken);
    return;
  }

  if (action === "again") {
    await runCreateSession(accounts, scopes, userId, apiKey, s);
  }
}

export async function main(): Promise<void> {
  printNote(
    [
      `${colour.DIM}A CLI tool for creating ${colour.WHITE}Cloudflare API Tokens${colour.RESET}${colour.DIM} with interactive, guided prompts.`,
      "",
      `${colour.DIM}You'll need a ${colour.WHITE}scoped API Token${colour.RESET}${colour.DIM} with ${colour.WHITE}User Details:Read${colour.RESET}${colour.DIM}, ${colour.WHITE}User API Tokens:Edit${colour.RESET}${colour.DIM}, and ${colour.WHITE}Account Settings:Read${colour.RESET}${colour.DIM} permissions.`,
      `${colour.DIM}Create one here: ${colour.CYAN}${hyperlinkUrl(CF_AUTH_TEMPLATE_URL)}${colour.RESET}`,
    ].join("\n"),
    "create-cf-token"
  );

  const { apiKey } = await askCredentials();

  const s = createSpinner();

  s.start("Verifying token...");
  const userResult = await getUser(apiKey);
  if (userResult.isErr()) {
    s.stop("Failed");
    handleApiError(userResult.error);
  }
  const user = userResult.value;
  s.stop(`Authenticated as ${user.email}`);

  s.start("Fetching accounts...");
  const accountsResult = await getAccounts(apiKey);
  if (accountsResult.isErr()) {
    s.stop("Failed");
    handleApiError(accountsResult.error);
  }
  const accounts = accountsResult.value;
  s.stop(`Found ${accounts.length} account(s)`);

  s.start("Fetching permission groups...");
  const permsResult = await getPermissionGroups(apiKey);
  if (permsResult.isErr()) {
    s.stop("Failed");
    handleApiError(permsResult.error);
  }
  const allPerms = permsResult.value;
  const scopes = groupByService(allPerms);
  s.stop(
    `Found ${scopes.length} scopes (${allPerms.length} permission groups)`
  );

  const authUrl = buildAuthTemplateUrl(allPerms);
  if (authUrl) {
    logMessage.info(
      `Auth token setup URL: ${colour.CYAN}${hyperlinkUrl(authUrl)}${colour.RESET}`
    );
  }

  try {
    await runCreateSession(accounts, scopes, user.id, apiKey, s);
  } catch (error) {
    if (TokenCreationFlowError.is(error) || TokenDeletionFlowError.is(error)) {
      matchError(error, {
        TokenCreationFlowError: (e) => logMessage.error(e.message),
        TokenDeletionFlowError: (e) => logMessage.error(e.message),
      });
      process.exitCode = 1;
      return;
    }

    throw error;
  }

  finishOutro("Done!");
}
