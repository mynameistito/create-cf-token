/**
 * @module create
 *
 * Programmatic non-interactive token creation from a declarative spec.
 */

import type { UnhandledException } from "better-result";
import {
  matchError,
  Result,
  TaggedError as createTaggedError,
} from "better-result";

import { createToken } from "#src/api.ts";
import type {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
} from "#src/errors.ts";
import { buildPolicies } from "#src/policies.ts";
import {
  resolvePermissionsFromScopeSpec,
  resolvePresetPermissions,
  ScopeSpecError,
} from "#src/scope-spec.ts";
import type { ScopeSpecErrorType } from "#src/scope-spec.ts";
import { normalizeAccountsInput, TokenSpecError } from "#src/spec.ts";
import type { TokenSpec, TokenSpecErrorType } from "#src/spec.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
  TokenPolicy,
  UserInfo,
} from "#src/types.ts";

const CreateFlowError = createTaggedError("CreateFlowError")<{
  message: string;
}>();

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
  if (!accountsInput || accountsInput.trim().toLowerCase() === "all") {
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
  accounts: Account[]
): Promise<{ excluded: string[]; token: CreatedToken }> {
  const excluded = new Set<string>(["API Tokens"]);
  const maxRetries = 50;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const policies = buildPolicies(chosenPerms, userId, accounts, excluded);

    if (policies.length === 0) {
      throw new CreateFlowError({
        message: "All selected permissions were restricted. Aborting.",
      });
    }

    // oxlint-disable-next-line no-await-in-loop -- retries must be sequential
    const result = await createToken(apiToken, tokenName, policies);

    if (result.isOk()) {
      const filteredExcluded = [...excluded].filter(
        (name) => name !== "API Tokens"
      );
      return { excluded: filteredExcluded, token: result.value };
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
  }

  throw new CreateFlowError({
    message: `Failed after ${maxRetries} attempts. Too many restricted permissions.`,
  });
}

/**
 * Create a Cloudflare API token from a declarative spec without interactive prompts.
 */
export function createTokenFromSpec(
  spec: TokenSpec,
  context: CreateTokenContext
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

      const policies = buildPolicies(
        chosenPerms,
        context.user.id,
        selectedAccounts
      );

      if (spec.dryRun) {
        return {
          excludedPermissions: [],
          policies,
        };
      }

      const { excluded, token } = await attemptCreateWithRetry(
        context.apiToken,
        spec.name,
        chosenPerms,
        context.user.id,
        selectedAccounts
      );

      return {
        excludedPermissions: excluded,
        policies,
        token,
      };
    },
  });
}

export { CreateFlowError };
