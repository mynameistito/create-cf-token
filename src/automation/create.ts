/**
 * @module automation/create
 *
 * Programmatic non-interactive token creation from a declarative spec.
 */

import type { UnhandledException } from "better-result";
import { matchError, Result } from "better-result";

import { createToken } from "#src/api/client.ts";
import {
  resolvePermissionsFromScopeSpec,
  resolvePresetPermissions,
  ScopeSpecError,
} from "#src/automation/scope-spec.ts";
import type { ScopeSpecErrorType } from "#src/automation/scope-spec.ts";
import {
  normalizeAccountsInput,
  TokenSpecError,
} from "#src/automation/spec.ts";
import type { TokenSpec, TokenSpecErrorType } from "#src/automation/spec.ts";
import { CreateFlowErrorBase } from "#src/errors/bases.ts";
import type {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
} from "#src/errors/index.ts";
import { buildPolicies } from "#src/policies/build.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
  TokenPolicy,
  UserInfo,
} from "#src/types/index.ts";

type CreateTokenFn = typeof createToken;

interface CreateTokenDeps {
  createToken: CreateTokenFn;
}

const defaultDeps: CreateTokenDeps = { createToken };

class CreateFlowError extends CreateFlowErrorBase {}

export type CreateFlowErrorType = InstanceType<typeof CreateFlowError>;

export type CreateTokenFromSpecError =
  | CloudflareApiError
  | CreateFlowErrorType
  | RestrictedPermissionError
  | ScopeSpecErrorType
  | TokenCreationError
  | TokenSpecErrorType
  | UnhandledException;

export interface CreateTokenContext {
  accounts: Account[];
  allPerms: PermissionGroup[];
  apiToken: string;
  scopes: ServiceGroup[];
  user: UserInfo;
}

export interface CreateTokenFromSpecResult {
  excludedPermissions: string[];
  policies: TokenPolicy[];
  token?: CreatedToken;
}

function resolveSelectedAccounts(
  accountsInput: string | undefined,
  accounts: Account[]
): Account[] {
  if (!accountsInput || accountsInput.trim() === "") {
    throw new CreateFlowError({
      message: 'Accounts required. Use "all" or comma-separated account IDs.',
    });
  }

  if (accountsInput.trim().toLowerCase() === "all") {
    return accounts;
  }

  const requested = accountsInput
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const selected: Account[] = [];
  const missing: string[] = [];

  for (const id of requested) {
    const account = accountMap.get(id);
    if (account) {
      selected.push(account);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    throw new CreateFlowError({
      message: `Unknown account ID(s): ${missing.join(", ")}. Run create-cf-token --list-accounts --json.`,
    });
  }

  return selected;
}

function resolvePermissions(
  spec: TokenSpec,
  scopes: ServiceGroup[],
  allPerms: PermissionGroup[]
): PermissionGroup[] {
  if (spec.preset === "full-access") {
    return resolvePresetPermissions(scopes);
  }

  if (!spec.scopes) {
    throw new CreateFlowError({
      message: "Token spec requires scopes or preset full-access.",
    });
  }

  return resolvePermissionsFromScopeSpec(scopes, allPerms, spec.scopes);
}

async function attemptCreateWithRetry(
  apiToken: string,
  tokenName: string,
  chosenPerms: PermissionGroup[],
  userId: string,
  accounts: Account[],
  deps: CreateTokenDeps,
  attempt = 1,
  excluded = new Set<string>(["API Tokens"])
): Promise<{
  excluded: string[];
  policies: TokenPolicy[];
  token: CreatedToken;
}> {
  const maxRetries = 50;
  const policies = buildPolicies(chosenPerms, userId, accounts, excluded);

  if (policies.length === 0) {
    throw new CreateFlowError({
      message: "All selected permissions were restricted. Aborting.",
    });
  }

  const result = await deps.createToken(apiToken, tokenName, policies);

  if (result.isOk()) {
    const filteredExcluded = [...excluded].filter(
      (name) => name !== "API Tokens"
    );
    return { excluded: filteredExcluded, policies, token: result.value };
  }

  const shouldRetry = matchError(result.error, {
    RestrictedPermissionError: (error) => {
      excluded.add(error.permissionName);
      return true;
    },
    TokenCreationError: (error) => {
      throw new CreateFlowError({
        message: `Error creating token:\n${error.errorText}`,
      });
    },
    UnhandledException: (error) => {
      throw new CreateFlowError({
        message: `Unexpected error: ${error.message}`,
      });
    },
  });

  if (!shouldRetry) {
    throw new CreateFlowError({
      message: "Token creation stopped unexpectedly.",
    });
  }

  if (attempt >= maxRetries) {
    throw new CreateFlowError({
      message: `Failed after ${maxRetries} attempts. Too many restricted permissions.`,
    });
  }

  return attemptCreateWithRetry(
    apiToken,
    tokenName,
    chosenPerms,
    userId,
    accounts,
    deps,
    attempt + 1,
    excluded
  );
}

/**
 * Create a Cloudflare API token from a declarative spec without interactive prompts.
 */
export function createTokenFromSpec(
  spec: TokenSpec,
  context: CreateTokenContext,
  deps: CreateTokenDeps = defaultDeps
): Promise<Result<CreateTokenFromSpecResult, CreateTokenFromSpecError>> {
  return Result.tryPromise({
    catch: (error) => {
      if (
        CreateFlowError.is(error) ||
        ScopeSpecError.is(error) ||
        TokenSpecError.is(error)
      ) {
        return error;
      }
      return error as CreateTokenFromSpecError;
    },
    try: async () => {
      const accountsInput = normalizeAccountsInput(spec.accounts);
      const selectedAccounts = resolveSelectedAccounts(
        accountsInput ?? (spec.preset === "full-access" ? "all" : undefined),
        context.accounts
      );

      const chosenPerms = resolvePermissions(
        spec,
        context.scopes,
        context.allPerms
      );

      const excluded = new Set<string>(["API Tokens"]);
      const policies = buildPolicies(
        chosenPerms,
        context.user.id,
        selectedAccounts,
        excluded
      );

      if (spec.dryRun) {
        return {
          excludedPermissions: [],
          policies,
        };
      }

      const {
        excluded: excludedNames,
        policies: finalPolicies,
        token,
      } = await attemptCreateWithRetry(
        context.apiToken,
        spec.name,
        chosenPerms,
        context.user.id,
        selectedAccounts,
        deps
      );

      return {
        excludedPermissions: excludedNames,
        policies: finalPolicies,
        token,
      };
    },
  });
}

export { CreateFlowError };
