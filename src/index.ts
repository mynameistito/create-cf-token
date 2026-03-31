import type { UnhandledException } from "better-result";
import { matchError } from "better-result";
import {
  createToken,
  getAccounts,
  getPermissionGroups,
  getUser,
} from "./api.ts";
import colour from "./colour.ts";
import type { CloudflareApiError } from "./errors.ts";
import { groupByService } from "./permissions.ts";
import {
  askCreateAnother,
  askCredentials,
  askTokenName,
  CF_API_TOKENS_URL,
  cancelPrompt,
  createSpinner,
  finishOutro,
  logMessage,
  printNote,
  selectAccounts,
  selectServices,
  showNote,
} from "./prompts.ts";
import type { PermissionGroup, Policy } from "./types.ts";

const NAME = "create-cf-token";
const VERSION = "0.1.0";

const { WHITE, CYAN, DIM, RESET } = colour;

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

    ${CYAN}CF_EMAIL${RESET}              Pre-fill the Cloudflare account email prompt
    ${CYAN}CF_API_TOKEN${RESET}          Cloudflare Global API Key for authentication

  ${DIM}https://github.com/mynameistito/create-cf-token${RESET}
`;

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

type ApiError = CloudflareApiError | UnhandledException;

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

async function attemptCreateToken(
  tokenName: string,
  userPerms: PermissionGroup[],
  accountPerms: PermissionGroup[],
  zonePerms: PermissionGroup[],
  userResources: Record<string, string>,
  accountResources: Record<string, string>,
  email: string,
  apiKey: string,
  s: ReturnType<typeof createSpinner>
): Promise<boolean> {
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
      cancelPrompt("All selected permissions were restricted. Aborting.");
      return false;
    }

    const result = await createToken(tokenName, policies, email, apiKey);

    if (result.isOk()) {
      s.stop(`Token created (attempt ${attempt})`);
      showNote(result.value, "Your API Token");
      logMessage.warn("Save this now — it will not be shown again.");
      if (excluded.size > 1) {
        logMessage.info(
          `Excluded ${excluded.size} restricted permissions:\n${[...excluded].map((n) => `  - ${n}`).join("\n")}`
        );
      }
      return true;
    }

    const shouldRetry = matchError(result.error, {
      RestrictedPermissionError: (e) => {
        excluded.add(e.permissionName);
        s.message(`Attempt ${attempt} — excluded: ${e.permissionName}`);
        return true;
      },
      TokenCreationError: (e) => {
        s.stop("Failed");
        logMessage.error(`Error creating token:\n${e.errorText}`);
        return false;
      },
      UnhandledException: (e) => {
        s.stop("Failed");
        logMessage.error(`Unexpected error: ${e.message}`);
        return false;
      },
    });

    if (!shouldRetry) {
      return false;
    }
  }

  s.stop("Failed");
  logMessage.error(
    `Failed after ${maxRetries} attempts. Too many restricted permissions.`
  );
  return false;
}

export function handleApiError(error: ApiError): never {
  matchError(error, {
    CloudflareApiError: (e) => {
      cancelPrompt(
        `${e.message}\n\nYour API key or email may be incorrect.\nGet your Global API Key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
      );
    },
    UnhandledException: (e) => cancelPrompt(e.message),
  });
  process.exit(1);
}

export async function main(): Promise<void> {
  printNote(
    [
      `${colour.DIM}A CLI tool for creating ${colour.WHITE}Cloudflare API Tokens${colour.RESET}${colour.DIM} with interactive, guided prompts.`,
      "",
      `${colour.DIM}You'll need your ${colour.WHITE}Account Email${colour.RESET}${colour.DIM} and ${colour.WHITE}Global API Key${colour.RESET}${colour.DIM}.`,
      `${colour.DIM}Get your key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`,
    ].join("\n"),
    "create-cf-token"
  );

  const { email, apiKey } = await askCredentials();

  const s = createSpinner();

  // Fetch user
  s.start("Fetching user info...");
  const userResult = await getUser(email, apiKey);
  if (userResult.isErr()) {
    s.stop("Failed");
    handleApiError(userResult.error);
  }
  const user = userResult.value;
  s.stop(`Authenticated as ${user.email}`);

  // Fetch accounts
  s.start("Fetching accounts...");
  const accountsResult = await getAccounts(email, apiKey);
  if (accountsResult.isErr()) {
    s.stop("Failed");
    handleApiError(accountsResult.error);
  }
  const accounts = accountsResult.value;
  s.stop(`Found ${accounts.length} account(s)`);

  // Fetch permissions & group by service (once, reused across all tokens)
  s.start("Fetching permission groups...");
  const permsResult = await getPermissionGroups(email, apiKey);
  if (permsResult.isErr()) {
    s.stop("Failed");
    handleApiError(permsResult.error);
  }
  const allPerms = permsResult.value;
  const services = groupByService(allPerms);
  s.stop(
    `Found ${services.length} services (${allPerms.length} permission groups)`
  );

  let looping = true;
  while (looping) {
    const selectedAccounts = await selectAccounts(accounts);

    // Pick services + access levels
    const chosenPerms = await selectServices(services);

    // Split by scope
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

    // Build resources
    const userResources: Record<string, string> = {
      [`com.cloudflare.api.user.${user.id}`]: "*",
    };
    const accountResources: Record<string, string> = {};
    for (const acct of selectedAccounts) {
      accountResources[`com.cloudflare.api.account.${acct.id}`] = "*";
    }

    // Token name
    const names = selectedAccounts.map((a) => a.name).join(", ");
    const defaultName =
      selectedAccounts.length === accounts.length ? "All Accounts" : names;
    const tokenName = await askTokenName(defaultName);

    const created = await attemptCreateToken(
      tokenName,
      userPerms,
      accountPerms,
      zonePerms,
      userResources,
      accountResources,
      email,
      apiKey,
      s
    );

    if (!created) {
      return;
    }

    looping = await askCreateAnother();
  }

  finishOutro("Done!");
}
