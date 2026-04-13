/**
 * @module index
 *
 * CLI orchestrator for the create-cf-token tool.
 *
 * The {@linkcode main} function drives the full interactive flow:
 * credential collection → user/account/permission fetching → scope selection
 * → token creation with automatic restricted-permission retry → post-create actions.
 *
 * Error handling uses `better-result` tagged errors throughout. API-level errors
 * are funnelled through {@linkcode handleApiError} (never-returning). Flow-level
 * errors use {@linkcode TokenCreationFlowError} and {@linkcode TokenDeletionFlowError}.
 */

import type { UnhandledException } from "better-result";
import { matchError, TaggedError } from "better-result";
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
  askPostCreateAction,
  askTokenName,
  CF_API_TOKENS_URL,
  cancelPrompt,
  createSpinner,
  finishOutro,
  GO_BACK,
  logMessage,
  printNote,
  selectAccounts,
  selectScopes,
  showNote,
} from "#src/prompts.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  Policy,
} from "#src/types.ts";

const NAME = "create-cf-token";
const VERSION = process.env.npm_package_version ?? "0.0.0";

const { WHITE, CYAN, DIM, RESET } = colour;

/**
 * Internal error thrown when the token creation flow fails
 * (e.g. all permissions were restricted, unexpected API error).
 */
class TokenCreationFlowError extends TaggedError("TokenCreationFlowError")<{
  message: string;
}>() {}

/**
 * Internal error thrown when token deletion (revocation) fails
 * during the post-create modify/delete flow.
 */
class TokenDeletionFlowError extends TaggedError("TokenDeletionFlowError")<{
  message: string;
}>() {}

/** Help text displayed when the user passes `--help` or `-h`. */
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

    ${CYAN}CF_API_TOKEN${RESET}          Cloudflare Create Additional Tokens Key for authentication

  ${DIM}https://github.com/mynameistito/create-cf-token${RESET}
`;

/**
 * Handle CLI flags (`--help`, `--version`).
 *
 * @returns `true` if a flag was handled and the process should not continue; `false` otherwise.
 */
export function handleFlags(): boolean {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    return true;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return true;
  }
  return false;
}

/** Union of API-level errors that can occur during fetch calls. */
type ApiError = CloudflareApiError | UnhandledException;

/**
 * Build Cloudflare API token policies from the selected permission groups.
 *
 * Permissions are split into three buckets (user, account, zone) based on their
 * scope. Each bucket becomes a separate policy with its own resource set.
 * Permissions named in the `excluded` set are filtered out (used during
 * restricted-permission retry).
 *
 * @param userPerms - Permissions scoped to the user level.
 * @param accountPerms - Permissions scoped to the account level.
 * @param zonePerms - Permissions scoped to the zone level.
 * @param excluded - Permission names to exclude from the policies.
 * @param userResources - Resource URIs for user-level access (e.g. `com.cloudflare.api.user.<id>: *`).
 * @param accountResources - Resource URIs for account- and zone-level access.
 * @returns An array of {@linkcode Policy} objects ready for the API.
 */
export function buildPolicies(
  userPerms: PermissionGroup[],
  accountPerms: PermissionGroup[],
  zonePerms: PermissionGroup[],
  excluded: Set<string>,
  userResources: Record<string, string>,
  accountResources: Record<string, string>
): Policy[] {
  const toIds = (perms: PermissionGroup[]) =>
    perms.filter((pg) => !excluded.has(pg.name)).map((pg) => ({ id: pg.id }));

  const policies: Policy[] = [];
  const uIds = toIds(userPerms);
  const aIds = toIds(accountPerms);
  const zIds = toIds(zonePerms);

  if (uIds.length > 0) {
    policies.push({
      effect: "allow",
      resources: userResources,
      permission_groups: uIds,
    });
  }
  if (aIds.length > 0) {
    policies.push({
      effect: "allow",
      resources: accountResources,
      permission_groups: aIds,
    });
  }
  if (zIds.length > 0) {
    policies.push({
      effect: "allow",
      resources: accountResources,
      permission_groups: zIds,
    });
  }

  return policies;
}

/**
 * Attempt to create a Cloudflare API token, retrying up to 50 times when
 * the API rejects individual permissions as restricted.
 *
 * On each retry, the offending permission is added to the exclusion set and
 * the policies are rebuilt without it. The "API Tokens" permission is always
 * excluded on the first attempt.
 *
 * @param tokenName - The name for the new token.
 * @param userPerms - User-scoped permission groups.
 * @param accountPerms - Account-scoped permission groups.
 * @param zonePerms - Zone-scoped permission groups.
 * @param userResources - Resource URI map for user permissions.
 * @param accountResources - Resource URI map for account/zone permissions.
 * @param token - Create Additional Tokens Key.
 * @param s - Clack spinner instance for progress feedback.
 * @returns The created token on success.
 * @throws {TokenCreationFlowError} On unrecoverable errors or max retries exceeded.
 */
async function attemptCreateToken(
  tokenName: string,
  userPerms: PermissionGroup[],
  accountPerms: PermissionGroup[],
  zonePerms: PermissionGroup[],
  userResources: Record<string, string>,
  accountResources: Record<string, string>,
  token: string,
  s: ReturnType<typeof createSpinner>
): Promise<CreatedToken> {
  const excluded = new Set<string>(["API Tokens"]);
  const maxRetries = 50;

  s.start("Creating token...");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const policies = buildPolicies(
      userPerms,
      accountPerms,
      zonePerms,
      excluded,
      userResources,
      accountResources
    );

    if (policies.length === 0) {
      s.stop("No permissions left to grant.");
      throw new TokenCreationFlowError({
        message: "All selected permissions were restricted. Aborting.",
      });
    }

    const result = await createToken(tokenName, policies, token);

    if (result.isOk()) {
      s.stop(`Token created (attempt ${attempt})`);
      showNote(result.value.value, "Your API Token");
      logMessage.warn("Save this now — it will not be shown again.");
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

/**
 * Drive the full interactive token creation sub-flow:
 * account selection → scope selection → access level → naming → creation.
 *
 * Supports back-navigation: pressing Backspace at the scope selection returns
 * to account selection; pressing Backspace at the token name returns to scope
 * selection.
 *
 * @param accounts - Accounts available for selection.
 * @param scopes - Permission groups organised by service.
 * @param userId - The authenticated user's ID (used in resource URIs).
 * @param token - Create Additional Tokens Key.
 * @param s - Clack spinner instance.
 * @returns The created token.
 * @throws {TokenCreationFlowError} If the flow exits unexpectedly.
 */
async function createTokenFlow(
  accounts: Account[],
  scopes: ReturnType<typeof groupByService>,
  userId: string,
  token: string,
  s: ReturnType<typeof createSpinner>
): Promise<CreatedToken> {
  let selectedAccounts = await selectAccounts(accounts);
  let choosingToken = true;

  while (choosingToken) {
    const chosenPerms = await selectScopes(scopes);
    if (chosenPerms === GO_BACK) {
      selectedAccounts = await selectAccounts(accounts);
      continue;
    }

    const userPerms = chosenPerms.filter((pg) =>
      pg.scopes.includes("com.cloudflare.api.user")
    );
    const accountPerms = chosenPerms.filter((pg) =>
      pg.scopes.includes("com.cloudflare.api.account")
    );
    const zonePerms = chosenPerms.filter((pg) =>
      pg.scopes.includes("com.cloudflare.api.account.zone")
    );

    logMessage.info(
      `Selected ${userPerms.length} user, ${accountPerms.length} account, ${zonePerms.length} zone permissions`
    );

    const userResources: Record<string, string> = {
      [`com.cloudflare.api.user.${userId}`]: "*",
    };
    const accountResources: Record<string, string> = {};
    for (const acct of selectedAccounts) {
      accountResources[`com.cloudflare.api.account.${acct.id}`] = "*";
    }

    const names = selectedAccounts.map((a) => a.name).join(", ");
    const defaultName =
      selectedAccounts.length === accounts.length ? "All Accounts" : names;
    const tokenName = await askTokenName(defaultName);

    if (tokenName === GO_BACK) {
      continue;
    }

    const createdToken = await attemptCreateToken(
      tokenName,
      userPerms,
      accountPerms,
      zonePerms,
      userResources,
      accountResources,
      token,
      s
    );
    choosingToken = false;
    return createdToken;
  }

  throw new TokenCreationFlowError({
    message: "Token creation flow exited unexpectedly.",
  });
}

/**
 * Delete one or more API tokens by their IDs.
 *
 * @param tokensToDelete - Tokens to revoke.
 * @param token - Create Additional Tokens Key.
 * @param s - Clack spinner instance for progress feedback.
 * @throws {TokenDeletionFlowError} If any deletion fails.
 */
async function deleteTokens(
  tokensToDelete: CreatedToken[],
  authToken: string,
  s: ReturnType<typeof createSpinner>
): Promise<void> {
  s.start(
    tokensToDelete.length === 1 ? "Deleting token..." : "Deleting tokens..."
  );

  for (const token of tokensToDelete) {
    const result = await deleteToken(token.id, authToken);

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

/**
 * Handle an API-level error by displaying it to the user and exiting.
 *
 * This function **never returns** — it always terminates the process with exit code 1.
 *
 * @param error - The API error to handle.
 */
export function handleApiError(error: ApiError): never {
  matchError(error, {
    CloudflareApiError: (e) => {
      cancelPrompt(
        `${e.message}\n\nYour token may be incorrect.\nGet your Create Additional Tokens Key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
      );
    },
    UnhandledException: (e) => cancelPrompt(e.message),
  });
  process.exit(1);
}

/**
 * Top-level error handler for uncaught errors in the CLI.
 * Logs the error stack or stringified value and exits with code 1.
 *
 * @param err - The thrown error.
 */
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

/**
 * Main entry point for the CLI.
 *
 * Orchestrates the full flow:
 * 1. Display welcome note
 * 2. Collect credentials
 * 3. Fetch user info, accounts, and permission groups
 * 4. Loop: account selection → scope selection → token creation
 * 5. Post-create actions (keep, modify, delete, create another)
 *
 * Flow-level errors ({@linkcode TokenCreationFlowError}, {@linkcode TokenDeletionFlowError})
 * are caught and logged; other errors propagate to {@linkcode handleCliError}.
 */
export async function main(): Promise<void> {
  printNote(
    [
      `${colour.DIM}A CLI tool for creating ${colour.WHITE}Cloudflare API Tokens${colour.RESET}${colour.DIM} with interactive, guided prompts.`,
      "",
      `${colour.DIM}You'll need a ${colour.WHITE}Create Additional Tokens Key${colour.RESET}${colour.DIM}.`,
      `${colour.DIM}Get your key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}${colour.DIM} → Create Token → ${colour.WHITE}Create Additional Tokens${colour.RESET}${colour.DIM} template`,
    ].join("\n"),
    "create-cf-token"
  );

  const { token } = await askCredentials();

  const s = createSpinner();

  // Fetch user
  s.start("Fetching user info...");
  const userResult = await getUser(token);
  if (userResult.isErr()) {
    s.stop("Failed");
    handleApiError(userResult.error);
  }
  const user = userResult.value;
  s.stop(`Authenticated as ${user.email}`);

  // Fetch accounts
  s.start("Fetching accounts...");
  const accountsResult = await getAccounts(token);
  if (accountsResult.isErr()) {
    s.stop("Failed");
    handleApiError(accountsResult.error);
  }
  const accounts = accountsResult.value;
  s.stop(`Found ${accounts.length} account(s)`);

  // Fetch permissions & group by service (once, reused across all tokens)
  s.start("Fetching permission groups...");
  const permsResult = await getPermissionGroups(token);
  if (permsResult.isErr()) {
    s.stop("Failed");
    handleApiError(permsResult.error);
  }
  const allPerms = permsResult.value;
  const scopes = groupByService(allPerms);
  s.stop(
    `Found ${scopes.length} scopes (${allPerms.length} permission groups)`
  );

  try {
    let looping = true;
    let previousToken: CreatedToken | undefined;
    while (looping) {
      const createdToken = await createTokenFlow(
        accounts,
        scopes,
        user.id,
        token,
        s
      );

      if (previousToken) {
        await deleteTokens([previousToken], token, s);
        previousToken = undefined;
      }

      const action = await askPostCreateAction();

      if (action === "revoke-done") {
        await deleteTokens([createdToken], token, s);
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
