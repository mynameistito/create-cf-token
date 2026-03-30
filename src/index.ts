#!/usr/bin/env node
import { cancel, log, note, outro, spinner } from "@clack/prompts";
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
  askCredentials,
  askTokenName,
  CF_API_TOKENS_URL,
  printNote,
  selectAccounts,
  selectServices,
} from "./prompts.ts";
import type { PermissionGroup, Policy } from "./types.ts";

type ApiError = CloudflareApiError | UnhandledException;

function buildPolicies(
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

function handleApiError(error: ApiError): never {
  if (error._tag === "CloudflareApiError") {
    cancel(
      `${error.message}\n\nYour API key or email may be incorrect.\nGet your Global API Key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
    );
  } else {
    cancel(error.message);
  }
  process.exit(1);
}

async function main() {
  //intro("Create Cloudflare API Token");
  printNote(
    `
      \nA CLI for creating Cloudflare API tokens (User Tokens) with an interactive, guided prompt flow.

      \n${colour.WHITE}You'll need your Cloudflare account email and Global API Key.${colour.RESET}\nGet your key: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}
    `,
    "create-cf-token"
  );

  const { email, apiKey } = await askCredentials();

  const s = spinner();

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

  const selectedAccounts = await selectAccounts(accounts);

  // Fetch permissions & group by service
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

  log.info(
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

  // Create token with retry loop (auto-excludes restricted perms)
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
      cancel("All selected permissions were restricted. Aborting.");
      return;
    }

    const result = await createToken(tokenName, policies, email, apiKey);

    if (result.isOk()) {
      s.stop(`Token created (attempt ${attempt})`);
      note(result.value, "Your API Token");
      log.warn("Save this now — it will not be shown again.");

      if (excluded.size > 1) {
        log.info(
          `Excluded ${excluded.size} restricted permissions:\n${[...excluded].map((n) => `  - ${n}`).join("\n")}`
        );
      }

      outro("Done!");
      return;
    }

    const handled = result.error;

    const shouldRetry = matchError(handled, {
      RestrictedPermissionError: (e) => {
        excluded.add(e.permissionName);
        s.message(`Attempt ${attempt} — excluded: ${e.permissionName}`);
        return true;
      },
      TokenCreationError: (e) => {
        s.stop("Failed");
        log.error(`Error creating token:\n${e.errorText}`);
        return false;
      },
      UnhandledException: (e) => {
        s.stop("Failed");
        log.error(`Unexpected error: ${e.message}`);
        return false;
      },
    });

    if (!shouldRetry) {
      return;
    }
  }

  s.stop("Failed");
  log.error(
    `Failed after ${maxRetries} attempts. Too many restricted permissions.`
  );
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
