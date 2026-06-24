/**
 * @module automation/create
 *
 * Programmatic non-interactive token creation from a declarative spec.
 */

import type { UnhandledException } from "better-result";
import { matchError, Result } from "better-result";

import { createToken } from "@/api/client.ts";
import {
  resolvePermissionsFromScopeSpec,
  resolvePresetPermissions,
  ScopeSpecError,
} from "@/automation/scope-spec.ts";
import type { ScopeSpecErrorType } from "@/automation/scope-spec.ts";
import { normalizeAccountsInput, TokenSpecError } from "@/automation/spec.ts";
import type { TokenSpec, TokenSpecErrorType } from "@/automation/spec.ts";
import { CreateFlowErrorBase } from "@/errors/bases.ts";
import { CloudflareApiError } from "@/errors/index.ts";
import type {
  RestrictedPermissionError,
  TokenCreationError,
} from "@/errors/index.ts";
import { buildTokenManagementExclusions } from "@/permissions/group.ts";
import { buildPolicies } from "@/policies/build.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
  TokenPolicy,
  UserInfo,
} from "@/types/index.ts";

type CreateTokenFn = typeof createToken;

interface CreateTokenDeps {
  createToken: CreateTokenFn;
}

const defaultDeps: CreateTokenDeps = { createToken };

/** Non-interactive create flow failure (invalid accounts, empty policies, retry exhaustion). */
class CreateFlowError extends CreateFlowErrorBase {}

/** Instance type of {@linkcode CreateFlowError}. */
export type CreateFlowErrorType = InstanceType<typeof CreateFlowError>;

/** Error union returned by {@linkcode createTokenFromSpec}. */
export type CreateTokenFromSpecError =
  | CloudflareApiError
  | CreateFlowErrorType
  | RestrictedPermissionError
  | ScopeSpecErrorType
  | TokenCreationError
  | TokenSpecErrorType
  | UnhandledException;

/** Cloudflare API data required to resolve and create a token from a spec. */
export interface CreateTokenContext {
  /** Accounts visible to the bearer token (from {@linkcode getAccounts}). */
  accounts: Account[];
  /** All assignable permission groups (from {@linkcode getPermissionGroups}). */
  allPerms: PermissionGroup[];
  /** Bearer token used for the create request. */
  apiToken: string;
  /** Service-level permission groupings (from {@linkcode groupByService}). */
  scopes: ServiceGroup[];
  /** Authenticated user (from {@linkcode getUser}). */
  user: UserInfo;
}

/** Successful result of {@linkcode createTokenFromSpec}. */
export interface CreateTokenFromSpecResult {
  /** Permission names auto-excluded after {@linkcode RestrictedPermissionError} retries. */
  excludedPermissions: string[];
  /** Resolved Cloudflare policy objects sent to (or previewed for) the API. */
  policies: TokenPolicy[];
  /** Created token; omitted when `spec.dryRun` is true. */
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
  excluded?: Set<string>
): Promise<{
  excluded: string[];
  policies: TokenPolicy[];
  token: CreatedToken;
}> {
  const maxRetries = 50;
  const activeExcluded =
    excluded ?? buildTokenManagementExclusions(chosenPerms);
  const policies = buildPolicies(chosenPerms, userId, accounts, activeExcluded);

  if (policies.length === 0) {
    throw new CreateFlowError({
      message: "All selected permissions were restricted. Aborting.",
    });
  }

  const result = await deps.createToken(apiToken, tokenName, policies);

  if (result.isOk()) {
    const filteredExcluded = [...activeExcluded];
    return { excluded: filteredExcluded, policies, token: result.value };
  }

  if (CloudflareApiError.is(result.error)) {
    throw result.error;
  }

  const shouldRetry = matchError(result.error, {
    RestrictedPermissionError: (error) => {
      const excludedBefore = activeExcluded.size;
      activeExcluded.add(error.permissionName);
      if (activeExcluded.size === excludedBefore) {
        throw new CreateFlowError({
          message: `Restricted permission "${error.permissionName}" was already excluded. Aborting to avoid retrying the same token policies.`,
        });
      }
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
    activeExcluded
  );
}

/**
 * Create a Cloudflare API token from a declarative spec without interactive prompts.
 *
 * Resolves accounts and permissions from `spec`, builds policies, and POSTs to the
 * Cloudflare API. Retries up to 50 times, auto-excluding permissions that return
 * {@linkcode RestrictedPermissionError}. When `spec.dryRun` is true, returns resolved
 * policies without calling the API.
 *
 * @param spec - Parsed token specification (`preset`, `scopes`, `accounts`, etc.).
 * @param context - Pre-fetched user, accounts, permissions, and bearer token.
 * @param deps - Optional dependency overrides (primarily for tests).
 * @returns A `Result` with policies and optional token on success; typed error on failure.
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

      const excluded = buildTokenManagementExclusions(chosenPerms);
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
