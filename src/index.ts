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
import colour from "#src/colour.ts";
import type { CloudflareApiError } from "#src/errors.ts";
import { groupByService } from "#src/permissions.ts";
import {
  askCredentials,
  askDeleteCreatedTokens,
  askPostCreateAction,
  askTokenName,
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
  selectAccounts,
  selectScopes,
  showCreatedToken,
} from "#src/prompts.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  TokenPolicy,
} from "#src/types.ts";

const NAME = "create-cf-token";
const VERSION = process.env.npm_package_version ?? "0.0.0";

const { WHITE, CYAN, DIM, RESET } = colour;

const TokenCreationFlowError = createTaggedError("TokenCreationFlowError")<{
  message: string;
}>();

const TokenDeletionFlowError = createTaggedError("TokenDeletionFlowError")<{
  message: string;
}>();

const HELP_TEXT = `
  ${WHITE}${NAME}${RESET} ${DIM}v${VERSION}${RESET}

  A CLI tool for creating Cloudflare API tokens with interactive, guided prompts.

  ${WHITE}Usage${RESET}

    ${CYAN}npm create cf-token${RESET}       ${DIM}via npm${RESET}
    ${CYAN}pnpm create cf-token${RESET}      ${DIM}via pnpm${RESET}
    ${CYAN}bun create cf-token${RESET}       ${DIM}via bun${RESET}

  ${WHITE}Options${RESET}

    ${CYAN}-h${RESET}, ${CYAN}--help${RESET}            Show this help message
    ${CYAN}-v${RESET}, ${CYAN}--version${RESET}         Show version number

  ${WHITE}Environment Variables${RESET}

    ${CYAN}CF_API_TOKEN${RESET}          Scoped Cloudflare API token for authentication

  ${DIM}https://github.com/mynameistito/create-cf-token${RESET}
`;

export function handleFlags(): boolean {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(HELP_TEXT);
    return true;
  }
  if (args.has("--version") || args.has("-v")) {
    console.log(VERSION);
    return true;
  }
  return false;
}

type ApiError = CloudflareApiError | UnhandledException;

export function buildPolicies(
  perms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  excluded: Set<string> = new Set<string>()
): TokenPolicy[] {
  const USER_SCOPE = "com.cloudflare.api.user";
  const ZONE_SCOPE = "com.cloudflare.api.account.zone";

  const filteredPerms = perms.filter((p) => !excluded.has(p.name));
  const userPerms = filteredPerms.filter((p) => p.scopes.includes(USER_SCOPE));
  const zonePerms = filteredPerms.filter(
    (p) => !p.scopes.includes(USER_SCOPE) && p.scopes.includes(ZONE_SCOPE)
  );
  const accountPerms = filteredPerms.filter(
    (p) => !(p.scopes.includes(USER_SCOPE) || p.scopes.includes(ZONE_SCOPE))
  );

  const policies: TokenPolicy[] = [];

  if (userPerms.length > 0) {
    policies.push({
      effect: "allow",
      permission_groups: userPerms.map((p) => ({ id: p.id })),
      resources: { [`com.cloudflare.api.user.${userId}`]: "*" },
    });
  }

  if (zonePerms.length > 0 && accounts.length > 0) {
    const zoneResources: Record<string, Record<string, "*">> = {};
    for (const acct of accounts) {
      zoneResources[`com.cloudflare.api.account.${acct.id}`] = {
        "com.cloudflare.api.account.zone.*": "*",
      };
    }
    policies.push({
      effect: "allow",
      permission_groups: zonePerms.map((p) => ({ id: p.id })),
      resources: zoneResources,
    });
  }

  if (accountPerms.length > 0 && accounts.length > 0) {
    const accountResources: Record<string, "*"> = {};
    for (const acct of accounts) {
      accountResources[`com.cloudflare.api.account.${acct.id}`] = "*";
    }
    policies.push({
      effect: "allow",
      permission_groups: accountPerms.map((p) => ({ id: p.id })),
      resources: accountResources,
    });
  }

  return policies;
}

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

async function deleteCreatedTokensFlow(
  sessionTokens: CreatedToken[],
  apiToken: string,
  s: ReturnType<typeof createSpinner>
): Promise<void> {
  const tokensToDelete = await askDeleteCreatedTokens(sessionTokens);

  if (tokensToDelete.length === 0) {
    return;
  }

  await deleteTokens(tokensToDelete, apiToken, s);
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
    const sessionTokens: CreatedToken[] = [];

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
      } else {
        sessionTokens.push(createdToken);
      }

      looping = action === "again" || action === "revoke-again";
    }

    if (sessionTokens.length > 0) {
      await deleteCreatedTokensFlow(sessionTokens, apiKey, s);
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
