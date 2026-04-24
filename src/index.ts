/**
 * @module index
 *
 * CLI orchestrator for the create-cf-token tool.
 *
 * The {@linkcode main} function drives the full interactive flow:
 * credential collection → permission fetching → scope selection
 * → template URL generation → post-create action.
 *
 * Error handling uses `better-result` tagged errors throughout. API-level errors
 * are funnelled through {@linkcode handleApiError} (never-returning).
 */

import type { UnhandledException } from "better-result";
import { matchError } from "better-result";
import {
  createToken,
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
import type { Account, PermissionGroup, TokenPolicy } from "#src/types.ts";

const NAME = "create-cf-token";
const VERSION = process.env.npm_package_version ?? "0.0.0";

const { WHITE, CYAN, DIM, RESET } = colour;

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

    ${CYAN}CF_API_TOKEN${RESET}          Scoped Cloudflare API token for authentication

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
 * Build token policies from selected permissions, scoped to specific accounts and user.
 *
 * User-scoped perms get a single user resource URI; account- and zone-scoped perms get
 * one resource URI per selected account. Each unique resource map becomes its own policy.
 *
 * @param perms - The resolved permission groups chosen by the user.
 * @param userId - The authenticated user's ID for user-scoped resource URIs.
 * @param accounts - The accounts to scope account/zone permissions to.
 * @returns An array of token policies ready for the Cloudflare API.
 */
export function buildPolicies(
  perms: PermissionGroup[],
  userId: string,
  accounts: Account[]
): TokenPolicy[] {
  const USER_SCOPE = "com.cloudflare.api.user";
  const ZONE_SCOPE = "com.cloudflare.api.account.zone";

  const userPerms = perms.filter((p) => p.scopes.includes(USER_SCOPE));
  const zonePerms = perms.filter(
    (p) => !p.scopes.includes(USER_SCOPE) && p.scopes.includes(ZONE_SCOPE)
  );
  const accountPerms = perms.filter(
    (p) => !(p.scopes.includes(USER_SCOPE) || p.scopes.includes(ZONE_SCOPE))
  );

  const policies: TokenPolicy[] = [];

  if (userPerms.length > 0) {
    policies.push({
      effect: "allow",
      resources: { [`com.cloudflare.api.user.${userId}`]: "*" },
      permission_groups: userPerms.map((p) => ({ id: p.id })),
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
      resources: zoneResources,
      permission_groups: zonePerms.map((p) => ({ id: p.id })),
    });
  }

  if (accountPerms.length > 0 && accounts.length > 0) {
    const accountResources: Record<string, "*"> = {};
    for (const acct of accounts) {
      accountResources[`com.cloudflare.api.account.${acct.id}`] = "*";
    }
    policies.push({
      effect: "allow",
      resources: accountResources,
      permission_groups: accountPerms.map((p) => ({ id: p.id })),
    });
  }

  return policies;
}

/**
 * Drive the interactive token creation sub-flow:
 * account selection → scope selection → token naming → API call → display token value.
 *
 * Supports back-navigation: Backspace at scope selection returns to account selection;
 * Backspace at token name returns to scope selection.
 *
 * @param accounts - Accounts available for selection.
 * @param scopes - Permission groups organised by service.
 * @param userId - The authenticated user's ID for user-scoped resource URIs.
 * @param apiKey - The authenticated API token used to create the new token.
 */
async function tokenCreateFlow(
  accounts: Account[],
  scopes: ReturnType<typeof groupByService>,
  userId: string,
  apiKey: string
): Promise<void> {
  let selectedAccounts = await selectAccounts(accounts);

  while (true) {
    const chosenPerms = await selectScopes(scopes);
    if (chosenPerms === GO_BACK) {
      selectedAccounts = await selectAccounts(accounts);
      continue;
    }

    const tokenName = await askTokenName("My Token");
    if (tokenName === GO_BACK) {
      continue;
    }

    const policies = buildPolicies(
      chosenPerms as PermissionGroup[],
      userId,
      selectedAccounts
    );
    const s = createSpinner();
    s.start("Creating token...");
    const createResult = await createToken(
      apiKey,
      tokenName as string,
      policies
    );
    if (createResult.isErr()) {
      s.stop("Failed");
      handleApiError(createResult.error);
    }
    s.stop("Token created!");

    showCreatedToken(createResult.value.value, createResult.value.name);
    return;
  }
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
        `${e.message}\n\nYour API token may be incorrect or missing required permissions.\nManage your tokens: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
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
 * 2. Collect API token credential
 * 3. Fetch user info and permission groups
 * 4. Loop: scope selection → token naming → template URL generation → display
 * 5. Post-create action (done or create another)
 */
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

  let looping = true;
  while (looping) {
    await tokenCreateFlow(accounts, scopes, user.id, apiKey);
    const action = await askPostCreateAction();
    looping = action === "again";
  }

  finishOutro("Done!");
}
