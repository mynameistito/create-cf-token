/**
 * @module flows/interactive-create
 *
 * Interactive token creation, retry, and deletion flow.
 */

import { matchError } from "better-result";

import { createToken, deleteToken } from "#src/api.ts";
import { TokenCreationFlowError } from "#src/flows/token-creation-flow-error.ts";
import { TokenDeletionFlowError } from "#src/flows/token-deletion-flow-error.ts";
import { buildPolicies } from "#src/policies.ts";
import {
  askTokenName,
  askTokenPreset,
  GO_BACK,
  logMessage,
  resolveFullAccessPermissions,
  selectAccounts,
  selectScopes,
  showCreatedToken,
} from "#src/prompts/index.ts";
import type { createSpinner } from "#src/prompts/logging.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
} from "#src/types.ts";

export { TokenCreationFlowError } from "#src/flows/token-creation-flow-error.ts";
export { TokenDeletionFlowError } from "#src/flows/token-deletion-flow-error.ts";

type Spinner = ReturnType<typeof createSpinner>;

async function attemptCreateToken(
  apiToken: string,
  tokenName: string,
  chosenPerms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  s: Spinner,
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
    attempt + 1,
    excluded
  );
}

async function deleteTokenAtIndex(
  tokensToDelete: CreatedToken[],
  apiToken: string,
  s: Spinner,
  index: number
): Promise<void> {
  if (index >= tokensToDelete.length) {
    return;
  }

  const token = tokensToDelete[index];
  if (!token) {
    return deleteTokenAtIndex(tokensToDelete, apiToken, s, index + 1);
  }

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
  return deleteTokenAtIndex(tokensToDelete, apiToken, s, index + 1);
}

export async function deleteTokens(
  tokensToDelete: CreatedToken[],
  apiToken: string,
  s: Spinner
): Promise<void> {
  s.start(
    tokensToDelete.length === 1 ? "Deleting token..." : "Deleting tokens..."
  );

  await deleteTokenAtIndex(tokensToDelete, apiToken, s, 0);

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
  s: Spinner
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
