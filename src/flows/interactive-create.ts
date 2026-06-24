/**
 * @module flows/interactive-create
 *
 * Interactive token creation, retry, and deletion flow.
 */

import { matchError } from "better-result";

import { createToken, deleteToken } from "@/api/client.ts";
import { TokenCreationFlowError } from "@/errors/token-creation-flow-error.ts";
import { TokenDeletionFlowError } from "@/errors/token-deletion-flow-error.ts";
import { buildPolicies } from "@/policies/build.ts";
import {
  askTokenName,
  askTokenPreset,
  GO_BACK,
  logMessage,
  resolveFullAccessPermissions,
  selectAccounts,
  selectScopes,
  showCreatedToken,
} from "@/prompts/index.ts";
import type { createSpinner } from "@/prompts/logging.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
} from "@/types/index.ts";

export { TokenCreationFlowError } from "@/errors/token-creation-flow-error.ts";
export { TokenDeletionFlowError } from "@/errors/token-deletion-flow-error.ts";

type Spinner = ReturnType<typeof createSpinner>;

interface InteractiveCreateDeps {
  askTokenName: typeof askTokenName;
  askTokenPreset: typeof askTokenPreset;
  createToken: typeof createToken;
  deleteToken: typeof deleteToken;
  logMessage: typeof logMessage;
  resolveFullAccessPermissions: typeof resolveFullAccessPermissions;
  selectAccounts: typeof selectAccounts;
  selectScopes: typeof selectScopes;
  showCreatedToken: typeof showCreatedToken;
}

const defaultDeps: InteractiveCreateDeps = {
  askTokenName,
  askTokenPreset,
  createToken,
  deleteToken,
  logMessage,
  resolveFullAccessPermissions,
  selectAccounts,
  selectScopes,
  showCreatedToken,
};

async function attemptCreateToken(
  apiToken: string,
  tokenName: string,
  chosenPerms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  s: Spinner,
  deps: InteractiveCreateDeps,
  attempt = 1,
  excluded = new Set<string>(["API Tokens"])
): Promise<CreatedToken> {
  const maxRetries = 50;

  if (attempt === 1) {
    s.start("Creating token...");
  }

  const policies = buildPolicies(chosenPerms, userId, accounts, excluded);

  if (policies.length === 0) {
    s.stop("No permissions left to grant.");
    throw new TokenCreationFlowError({
      message: "All selected permissions were restricted. Aborting.",
    });
  }

  const result = await deps.createToken(apiToken, tokenName, policies);

  if (result.isOk()) {
    s.stop(`Token created (attempt ${attempt})`);
    deps.showCreatedToken(result.value.value, result.value.name);
    const filteredExcluded = [...excluded].filter(
      (name) => name !== "API Tokens"
    );

    if (filteredExcluded.length > 0) {
      deps.logMessage.info(
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

  if (attempt >= maxRetries) {
    s.stop("Failed");
    throw new TokenCreationFlowError({
      message: `Failed after ${maxRetries} attempts. Too many restricted permissions.`,
    });
  }

  return attemptCreateToken(
    apiToken,
    tokenName,
    chosenPerms,
    userId,
    accounts,
    s,
    deps,
    attempt + 1,
    excluded
  );
}

async function deleteTokenAtIndex(
  tokensToDelete: CreatedToken[],
  apiToken: string,
  s: Spinner,
  deps: InteractiveCreateDeps,
  index: number
): Promise<void> {
  if (index >= tokensToDelete.length) {
    return;
  }

  const token = tokensToDelete[index];
  if (!token) {
    return deleteTokenAtIndex(tokensToDelete, apiToken, s, deps, index + 1);
  }

  const result = await deps.deleteToken(token.id, apiToken);

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
  return deleteTokenAtIndex(tokensToDelete, apiToken, s, deps, index + 1);
}

export async function deleteTokens(
  tokensToDelete: CreatedToken[],
  apiToken: string,
  s: Spinner,
  deps: InteractiveCreateDeps = defaultDeps
): Promise<void> {
  s.start(
    tokensToDelete.length === 1 ? "Deleting token..." : "Deleting tokens..."
  );

  await deleteTokenAtIndex(tokensToDelete, apiToken, s, deps, 0);

  s.stop(
    tokensToDelete.length === 1
      ? `Deleted token: ${tokensToDelete[0]?.name ?? "token"}`
      : `Deleted ${tokensToDelete.length} tokens`
  );
}

export async function tokenCreateFlow(
  accounts: Account[],
  scopes: ServiceGroup[],
  userId: string,
  apiToken: string,
  s: Spinner,
  deps: InteractiveCreateDeps = defaultDeps
): Promise<CreatedToken> {
  async function createWithAccounts(
    selectedAccounts: Account[]
  ): Promise<CreatedToken> {
    const chosenPerms = await deps.selectScopes(scopes);
    if (chosenPerms === GO_BACK) {
      const nextAccounts = await deps.selectAccounts(accounts);
      if (nextAccounts === GO_BACK) {
        return tokenCreateFlow(accounts, scopes, userId, apiToken, s, deps);
      }
      return createWithAccounts(nextAccounts);
    }

    const tokenName = await deps.askTokenName("My Token");
    if (tokenName === GO_BACK) {
      return createWithAccounts(selectedAccounts);
    }

    return attemptCreateToken(
      apiToken,
      tokenName as string,
      chosenPerms as PermissionGroup[],
      userId,
      selectedAccounts,
      s,
      deps
    );
  }

  const preset = await deps.askTokenPreset();

  if (preset === "full-access") {
    const tokenName = await deps.askTokenName("Full Access Token");
    if (tokenName === GO_BACK) {
      return tokenCreateFlow(accounts, scopes, userId, apiToken, s, deps);
    }

    return attemptCreateToken(
      apiToken,
      tokenName as string,
      deps.resolveFullAccessPermissions(scopes),
      userId,
      accounts,
      s,
      deps
    );
  }

  const selectedAccounts = await deps.selectAccounts(accounts);
  if (selectedAccounts === GO_BACK) {
    return tokenCreateFlow(accounts, scopes, userId, apiToken, s, deps);
  }
  return createWithAccounts(selectedAccounts);
}
