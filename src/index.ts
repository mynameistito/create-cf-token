/**
 * @module index
 *
 * CLI orchestrator for the create-cf-token tool.
 */

import type { UnhandledException } from "better-result";
import { matchError, TaggedError as createTaggedError } from "better-result";

import {
  createToken,
  deleteToken,
  getAccounts,
  getPermissionGroups,
  getUser,
} from "#src/api.ts";
import {
  failIfNonInteractiveIncomplete,
  runAutomationCreate,
  runDiscovery,
  shouldRunAutomation,
} from "#src/automation.ts";
import type { CliArgs, CliParseError } from "#src/cli-args.ts";
import { parseCliArgs } from "#src/cli-args.ts";
import colour from "#src/colour.ts";
import type { CloudflareApiError } from "#src/errors.ts";
import {
  AUTOMATION_HELP_TEXT,
  HELP_TEXT,
  printAutomationHelp,
  printHelp,
  printSkill,
  printVersion,
} from "#src/help.ts";
import { groupByService } from "#src/permissions.ts";
import { buildPolicies } from "#src/policies.ts";
import {
  askCredentials,
  askPostCreateAction,
  askTokenName,
  askTokenPreset,
  buildAuthTemplateUrl,
  CF_API_TOKENS_URL,
  CF_AUTH_TEMPLATE_URL,
  cancelPrompt,
  createSpinner,
  finishOutro,
  GO_BACK,
  hyperlinkUrl,
  logMessage,
  printNote,
  resolveFullAccessPermissions,
  selectAccounts,
  selectScopes,
  showCreatedToken,
} from "#src/prompts.ts";
import type { Account, CreatedToken, PermissionGroup } from "#src/types.ts";

export { buildPolicies } from "#src/policies.ts";

const TokenCreationFlowError = createTaggedError("TokenCreationFlowError")<{
  message: string;
}>();

const TokenDeletionFlowError = createTaggedError("TokenDeletionFlowError")<{
  message: string;
}>();

export type ParsedCli = CliArgs | CliParseError;

export function parseArgv(argv: string[] = process.argv.slice(2)): ParsedCli {
  return parseCliArgs(argv);
}

export function handleFlags(argv: string[] = process.argv.slice(2)): boolean {
  const parsed = parseCliArgs(argv);

  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return true;
  }

  switch (parsed.command) {
    case "help": {
      printHelp();
      return true;
    }
    case "help-automation": {
      printAutomationHelp();
      return true;
    }
    case "skill": {
      return false;
    }
    case "version": {
      printVersion();
      return true;
    }
    default: {
      return false;
    }
  }
}

export async function handleSkillFlag(): Promise<boolean> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if ("error" in parsed) {
    return false;
  }
  if (parsed.command === "skill") {
    await printSkill();
    return true;
  }
  return false;
}

export async function runAutomationIfNeeded(
  argv: string[] = process.argv.slice(2)
): Promise<boolean> {
  const parsed = parseCliArgs(argv);

  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return true;
  }

  failIfNonInteractiveIncomplete(parsed);

  if (
    parsed.command === "list-scopes" ||
    parsed.command === "list-permissions" ||
    parsed.command === "list-accounts"
  ) {
    await runDiscovery(parsed);
    return true;
  }

  if (shouldRunAutomation(parsed)) {
    await runAutomationCreate(parsed);
    return true;
  }

  return false;
}

export { AUTOMATION_HELP_TEXT, HELP_TEXT };

type ApiError = CloudflareApiError | UnhandledException;

async function attemptCreateToken(
  apiToken: string,
  tokenName: string,
  chosenPerms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  s: ReturnType<typeof createSpinner>
): Promise<CreatedToken> {
  const excluded = new Set<string>(["API Tokens"]);
  const maxRetries = 50;

  s.start("Creating token...");

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const policies = buildPolicies(chosenPerms, userId, accounts, excluded);

    if (policies.length === 0) {
      s.stop("No permissions left to grant.");
      throw new TokenCreationFlowError({
        message: "All selected permissions were restricted. Aborting.",
      });
    }

    // oxlint-disable-next-line no-await-in-loop -- retries must be sequential
    const result = await createToken(apiToken, tokenName, policies);

    if (result.isOk()) {
      s.stop(`Token created (attempt ${attempt})`);
      showCreatedToken(result.value.value, result.value.name);
      const filteredExcluded = [...excluded].filter(
        (name) => name !== "API Tokens"
      );

      if (filteredExcluded.length > 0) {
        logMessage.info(
          `Excluded ${filteredExcluded.length} restricted permissions:\n${filteredExcluded.map((name) => `  - ${name}`).join("\n")}`
        );
      }
      return result.value;
    }

    const shouldRetry = matchError(result.error, {
      RestrictedPermissionError: (e) => {
        excluded.add(e.permissionName);
        s.message(`Attempt ${attempt} — excluded: ${e.permissionName}`);
        return true;
      },
      TokenCreationError: (e) => {
        s.stop("Failed");
        throw new TokenCreationFlowError({
          message: `Error creating token:\n${e.errorText}`,
        });
      },
      UnhandledException: (e) => {
        s.stop("Failed");
        throw new TokenCreationFlowError({
          message: `Unexpected error: ${e.message}`,
        });
      },
    });

    if (!shouldRetry) {
      throw new TokenCreationFlowError({
        message: "Token creation stopped unexpectedly.",
      });
    }
  }

  s.stop("Failed");
  throw new TokenCreationFlowError({
    message: `Failed after ${maxRetries} attempts. Too many restricted permissions.`,
  });
}

async function deleteTokens(
  tokensToDelete: CreatedToken[],
  apiToken: string,
  s: ReturnType<typeof createSpinner>
): Promise<void> {
  s.start(
    tokensToDelete.length === 1 ? "Deleting token..." : "Deleting tokens..."
  );

  for (const token of tokensToDelete) {
    // oxlint-disable-next-line no-await-in-loop -- deletions must be sequential for spinner feedback
    const result = await deleteToken(token.id, apiToken);

    if (result.isErr()) {
      s.stop("Failed");

      const message: string = matchError(result.error, {
        TokenDeletionError: (error) =>
          `Error deleting token:\n${error.errorText}`,
        UnhandledException: (error) => `Unexpected error: ${error.message}`,
      });

      throw new TokenDeletionFlowError({ message });
    }

    s.message(`Deleted: ${token.name}`);
  }

  s.stop(
    tokensToDelete.length === 1
      ? `Deleted token: ${tokensToDelete[0]?.name ?? "token"}`
      : `Deleted ${tokensToDelete.length} tokens`
  );
}

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

async function tokenCreateFlow(
  accounts: Account[],
  scopes: ReturnType<typeof groupByService>,
  userId: string,
  apiToken: string,
  s: ReturnType<typeof createSpinner>
): Promise<CreatedToken> {
  async function createWithAccounts(
    selectedAccounts: Account[]
  ): Promise<CreatedToken> {
    const chosenPerms = await selectScopes(scopes);
    if (chosenPerms === GO_BACK) {
      const nextAccounts = await selectAccounts(accounts);
      return createWithAccounts(nextAccounts);
    }

    const tokenName = await askTokenName("My Token");
    if (tokenName === GO_BACK) {
      return createWithAccounts(selectedAccounts);
    }

    return attemptCreateToken(
      apiToken,
      tokenName as string,
      chosenPerms as PermissionGroup[],
      userId,
      selectedAccounts,
      s
    );
  }

  const preset = await askTokenPreset();

  if (preset === "full-access") {
    const tokenName = await askTokenName("Full Access Token");
    if (tokenName === GO_BACK) {
      return tokenCreateFlow(accounts, scopes, userId, apiToken, s);
    }

    return attemptCreateToken(
      apiToken,
      tokenName as string,
      resolveFullAccessPermissions(scopes),
      userId,
      accounts,
      s
    );
  }

  const selectedAccounts = await selectAccounts(accounts);
  return createWithAccounts(selectedAccounts);
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
    let looping = true;
    let previousToken: CreatedToken | undefined;

    while (looping) {
      // oxlint-disable-next-line no-await-in-loop -- interactive multi-token session
      const createdToken = await tokenCreateFlow(
        accounts,
        scopes,
        user.id,
        apiKey,
        s
      );

      if (previousToken) {
        // oxlint-disable-next-line no-await-in-loop -- modify flow deletes before next create
        await deleteTokens([previousToken], apiKey, s);
        previousToken = undefined;
      }

      // oxlint-disable-next-line no-await-in-loop -- post-create prompt follows each token
      const action = await askPostCreateAction();

      if (action === "revoke-done") {
        // oxlint-disable-next-line no-await-in-loop -- immediate revoke after user choice
        await deleteTokens([createdToken], apiKey, s);
      } else if (action === "revoke-again") {
        previousToken = createdToken;
      }

      looping = action === "again" || action === "revoke-again";
    }
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
