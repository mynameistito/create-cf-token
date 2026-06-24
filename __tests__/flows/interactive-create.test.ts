import { afterEach, describe, expect, mock, test } from "bun:test";

import { Result, UnhandledException } from "better-result";

import type { createToken, deleteToken } from "@/api/client.ts";
import { RestrictedPermissionError } from "@/errors/restricted-permission-error.ts";
import { TokenCreationError } from "@/errors/token-creation-error.ts";
import { TokenCreationFlowError } from "@/errors/token-creation-flow-error.ts";
import { TokenDeletionError } from "@/errors/token-deletion-error.ts";
import { TokenDeletionFlowError } from "@/errors/token-deletion-flow-error.ts";
import { deleteTokens, tokenCreateFlow } from "@/flows/interactive-create.ts";
import { resolveFullAccessPermissions } from "@/permissions/resolve.ts";
import type { createSpinner } from "@/prompts/logging.ts";
import { GO_BACK } from "@/prompts/types.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
} from "@/types/index.ts";

const mockAskTokenPreset = mock(() =>
  Promise.resolve("full-access" as "custom" | "full-access")
);
const mockAskTokenName = mock(() => Promise.resolve("My Test Token"));
const mockSelectScopes = mock(() => Promise.resolve([] as PermissionGroup[]));
const mockSelectAccounts = mock(() => Promise.resolve([] as Account[]));
const mockShowCreatedToken = mock(() => {});
const mockLogMessageInfo = mock(() => {});
const mockCreateToken = mock<typeof createToken>(() =>
  Promise.resolve(Result.ok({ id: "tok-new", name: "token", value: "secret" }))
);
const mockDeleteToken = mock<typeof deleteToken>(() =>
  Promise.resolve(Result.ok("tok-a"))
);

function buildDeps() {
  return {
    askTokenName: mockAskTokenName,
    askTokenPreset: mockAskTokenPreset,
    createToken: mockCreateToken,
    deleteToken: mockDeleteToken,
    logMessage: {
      error: mock(() => {}),
      info: mockLogMessageInfo,
      warn: mock(() => {}),
    },
    resolveFullAccessPermissions,
    selectAccounts: mockSelectAccounts,
    selectScopes: mockSelectScopes,
    showCreatedToken: mockShowCreatedToken,
  };
}

type Spinner = ReturnType<typeof createSpinner>;

const USER_ID = "user-123";
const ACCOUNTS: Account[] = [{ id: "acct-1", name: "Acme" }];
const SCOPES: ServiceGroup[] = [
  {
    name: "DNS",
    otherPerms: [],
    perms: [],
    readPerm: {
      description: "",
      id: "dns-read",
      name: "DNS Read",
      scopes: ["com.cloudflare.api.account.zone"],
    },
    scopes: ["com.cloudflare.api.account.zone"],
    writePerm: {
      description: "",
      id: "dns-write",
      name: "DNS Write",
      scopes: ["com.cloudflare.api.account.zone"],
    },
  },
];
const CHOSEN_PERMS: PermissionGroup[] = [
  {
    description: "",
    id: "dns-read",
    name: "DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
  {
    description: "",
    id: "dns-write",
    name: "DNS Write",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

const TOKEN_A: CreatedToken = {
  id: "tok-a",
  name: "Token A",
  value: "secret-a",
};

const TOKEN_B: CreatedToken = {
  id: "tok-b",
  name: "Token B",
  value: "secret-b",
};

function createMockSpinner(): Spinner {
  return {
    cancel: mock(() => {}),
    clear: mock(() => {}),
    error: mock(() => {}),
    isCancelled: mock(() => false),
    message: mock(() => {}),
    start: mock(() => {}),
    stop: mock(() => {}),
  } as unknown as Spinner;
}

afterEach(() => {
  mockAskTokenPreset.mockClear();
  mockAskTokenName.mockClear();
  mockSelectScopes.mockClear();
  mockSelectAccounts.mockClear();
  mockShowCreatedToken.mockClear();
  mockLogMessageInfo.mockClear();
  mockCreateToken.mockClear();
  mockDeleteToken.mockClear();
  mockCreateToken.mockResolvedValue(
    Result.ok({ id: "tok-new", name: "token", value: "secret" })
  );
  mockDeleteToken.mockResolvedValue(Result.ok("tok-a"));
});

describe("deleteTokens — success", () => {
  test("deletes a single token and updates the spinner", async () => {
    const spinner = createMockSpinner();
    await deleteTokens([TOKEN_A], "api-key", spinner, buildDeps());

    expect(spinner.start).toHaveBeenCalledWith("Deleting token...");
    expect(spinner.message).toHaveBeenCalledWith("Deleted: Token A");
    expect(spinner.stop).toHaveBeenCalledWith("Deleted token: Token A");
  });

  test("deletes multiple tokens sequentially", async () => {
    const spinner = createMockSpinner();
    await deleteTokens([TOKEN_A, TOKEN_B], "api-key", spinner, buildDeps());

    expect(spinner.start).toHaveBeenCalledWith("Deleting tokens...");
    expect(spinner.message).toHaveBeenCalledWith("Deleted: Token A");
    expect(spinner.message).toHaveBeenCalledWith("Deleted: Token B");
    expect(spinner.stop).toHaveBeenCalledWith("Deleted 2 tokens");
  });

  test("completes immediately when the token list is empty", async () => {
    const spinner = createMockSpinner();
    await deleteTokens([], "api-key", spinner, buildDeps());

    expect(spinner.start).toHaveBeenCalledWith("Deleting tokens...");
    expect(spinner.message).not.toHaveBeenCalled();
    expect(spinner.stop).toHaveBeenCalledWith("Deleted 0 tokens");
  });
});

describe("deleteTokens — failure", () => {
  test("throws TokenDeletionFlowError when delete fails", async () => {
    mockDeleteToken.mockResolvedValue(
      Result.err(new TokenDeletionError({ errorText: "Token not found" }))
    );
    const spinner = createMockSpinner();
    const badToken: CreatedToken = {
      id: "tok-bad",
      name: "Bad Token",
      value: "secret-bad",
    };

    let caught: unknown;
    try {
      await deleteTokens([badToken], "api-key", spinner, buildDeps());
    } catch (error) {
      caught = error;
    }

    expect(TokenDeletionFlowError.is(caught)).toBe(true);
    if (TokenDeletionFlowError.is(caught)) {
      expect(caught.message).toContain("Error deleting token");
    }
    expect(spinner.stop).toHaveBeenCalledWith("Failed");
  });

  test("throws TokenDeletionFlowError for unexpected delete failures", async () => {
    mockDeleteToken.mockResolvedValue(
      Result.err(new UnhandledException({ cause: new Error("network down") }))
    );
    const spinner = createMockSpinner();

    let caught: unknown;
    try {
      await deleteTokens([TOKEN_A], "api-key", spinner, buildDeps());
    } catch (error) {
      caught = error;
    }

    expect(TokenDeletionFlowError.is(caught)).toBe(true);
    if (TokenDeletionFlowError.is(caught)) {
      expect(caught.message).toContain("Unexpected error");
      expect(caught.message).toContain("network down");
    }
    expect(spinner.stop).toHaveBeenCalledWith("Failed");
  });

  test("skips sparse token entries during deletion", async () => {
    const spinner = createMockSpinner();
    const sparseTokens = [TOKEN_A, TOKEN_B, TOKEN_B] as CreatedToken[];
    delete sparseTokens[1];

    await deleteTokens(sparseTokens, "api-key", spinner, buildDeps());

    expect(mockDeleteToken).toHaveBeenCalledTimes(2);
    expect(spinner.message).toHaveBeenCalledWith("Deleted: Token A");
    expect(spinner.message).toHaveBeenCalledWith("Deleted: Token B");
  });
});

describe("tokenCreateFlow — full-access preset", () => {
  let createAttempts = 0;

  test("retries after RestrictedPermissionError and creates the token", async () => {
    createAttempts = 0;
    mockCreateToken.mockImplementation(() => {
      createAttempts += 1;
      if (createAttempts === 1) {
        return Promise.resolve(
          Result.err(
            new RestrictedPermissionError({
              errorText: "DNS Write is restricted",
              permissionName: "DNS Write",
            })
          )
        );
      }

      return Promise.resolve(
        Result.ok({
          id: "tok-new",
          name: "Full Access Token",
          value: "secret-new",
        })
      );
    });
    mockAskTokenPreset.mockResolvedValue("full-access");
    mockAskTokenName.mockResolvedValue("Full Access Token");

    const spinner = createMockSpinner();
    const token = await tokenCreateFlow(
      ACCOUNTS,
      SCOPES,
      USER_ID,
      "api-key",
      spinner,
      buildDeps()
    );

    expect(token.id).toBe("tok-new");
    expect(token.name).toBe("Full Access Token");
    expect(token.value).toBe("secret-new");
    expect(createAttempts).toBe(2);
    expect(spinner.start).toHaveBeenCalledWith("Creating token...");
    expect(spinner.message).toHaveBeenCalledWith(
      "Attempt 1 — excluded: DNS Write"
    );
    expect(spinner.stop).toHaveBeenCalledWith("Token created (attempt 2)");
    expect(mockShowCreatedToken).toHaveBeenCalledWith(
      "secret-new",
      "Full Access Token"
    );
    expect(mockLogMessageInfo).toHaveBeenCalledWith(
      expect.stringContaining("Excluded 1 restricted permissions")
    );
  });

  test("restarts preset selection when token name goes back", async () => {
    mockAskTokenPreset.mockResolvedValue("full-access");
    mockAskTokenName
      .mockResolvedValueOnce(GO_BACK as never)
      .mockResolvedValueOnce("Full Access Token");

    const spinner = createMockSpinner();
    const token = await tokenCreateFlow(
      ACCOUNTS,
      SCOPES,
      USER_ID,
      "api-key",
      spinner,
      buildDeps()
    );

    expect(token.id).toBe("tok-new");
    expect(mockAskTokenPreset).toHaveBeenCalledTimes(2);
    expect(mockAskTokenName).toHaveBeenCalledTimes(2);
  });
});

describe("tokenCreateFlow — custom preset", () => {
  test("uses mocked account and scope prompts for custom tokens", async () => {
    mockCreateToken.mockResolvedValue(
      Result.ok({
        id: "tok-custom",
        name: "Scoped Token",
        value: "secret-custom",
      })
    );
    mockAskTokenPreset.mockResolvedValue("custom");
    mockSelectAccounts.mockResolvedValue(ACCOUNTS);
    mockSelectScopes.mockResolvedValue(CHOSEN_PERMS);
    mockAskTokenName.mockResolvedValue("Scoped Token");

    const spinner = createMockSpinner();
    const token = await tokenCreateFlow(
      ACCOUNTS,
      SCOPES,
      USER_ID,
      "api-key",
      spinner,
      buildDeps()
    );

    expect(token.name).toBe("Scoped Token");
    expect(mockSelectAccounts).toHaveBeenCalledWith(ACCOUNTS);
    expect(mockSelectScopes).toHaveBeenCalledWith(SCOPES);
    expect(mockAskTokenName).toHaveBeenCalledWith("My Token");
  });

  test("reselects accounts when scope selection goes back", async () => {
    mockAskTokenPreset.mockResolvedValue("custom");
    mockSelectAccounts.mockResolvedValue(ACCOUNTS);
    mockSelectScopes
      .mockResolvedValueOnce(GO_BACK as never)
      .mockResolvedValueOnce(CHOSEN_PERMS);
    mockAskTokenName.mockResolvedValue("Scoped Token");

    const spinner = createMockSpinner();
    const token = await tokenCreateFlow(
      ACCOUNTS,
      SCOPES,
      USER_ID,
      "api-key",
      spinner,
      buildDeps()
    );

    expect(token.id).toBe("tok-new");
    expect(mockSelectAccounts).toHaveBeenCalledTimes(2);
    expect(mockSelectScopes).toHaveBeenCalledTimes(2);
  });

  test("reselects scopes when custom token name goes back", async () => {
    mockAskTokenPreset.mockResolvedValue("custom");
    mockSelectAccounts.mockResolvedValue(ACCOUNTS);
    mockSelectScopes.mockResolvedValue(CHOSEN_PERMS);
    mockAskTokenName
      .mockResolvedValueOnce(GO_BACK as never)
      .mockResolvedValueOnce("Scoped Token");

    const spinner = createMockSpinner();
    const token = await tokenCreateFlow(
      ACCOUNTS,
      SCOPES,
      USER_ID,
      "api-key",
      spinner,
      buildDeps()
    );

    expect(token.id).toBe("tok-new");
    expect(mockSelectScopes).toHaveBeenCalledTimes(2);
    expect(mockAskTokenName).toHaveBeenCalledTimes(2);
  });
});

describe("tokenCreateFlow — creation failures", () => {
  test("throws TokenCreationFlowError on generic API failure", async () => {
    mockCreateToken.mockResolvedValue(
      Result.err(new TokenCreationError({ errorText: "Something went wrong" }))
    );
    mockAskTokenPreset.mockResolvedValue("full-access");
    mockAskTokenName.mockResolvedValue("Doomed Token");

    const spinner = createMockSpinner();
    let caught: unknown;
    try {
      await tokenCreateFlow(
        ACCOUNTS,
        SCOPES,
        USER_ID,
        "api-key",
        spinner,
        buildDeps()
      );
    } catch (error) {
      caught = error;
    }

    expect(TokenCreationFlowError.is(caught)).toBe(true);
    if (TokenCreationFlowError.is(caught)) {
      expect(caught.message).toContain("Error creating token");
    }
    expect(spinner.stop).toHaveBeenCalledWith("Failed");
  });

  test("throws TokenCreationFlowError on unexpected create failure", async () => {
    mockCreateToken.mockResolvedValue(
      Result.err(new UnhandledException({ cause: new Error("fetch failed") }))
    );
    mockAskTokenPreset.mockResolvedValue("full-access");
    mockAskTokenName.mockResolvedValue("Doomed Token");

    const spinner = createMockSpinner();
    let caught: unknown;
    try {
      await tokenCreateFlow(
        ACCOUNTS,
        SCOPES,
        USER_ID,
        "api-key",
        spinner,
        buildDeps()
      );
    } catch (error) {
      caught = error;
    }

    expect(TokenCreationFlowError.is(caught)).toBe(true);
    if (TokenCreationFlowError.is(caught)) {
      expect(caught.message).toContain("Unexpected error");
      expect(caught.message).toContain("fetch failed");
    }
    expect(spinner.stop).toHaveBeenCalledWith("Failed");
  });

  test("throws TokenCreationFlowError after max retries", async () => {
    mockCreateToken.mockResolvedValue(
      Result.err(
        new RestrictedPermissionError({
          errorText: "Phantom Perm is restricted",
          permissionName: "Phantom Perm",
        })
      )
    );
    mockAskTokenPreset.mockResolvedValue("full-access");
    mockAskTokenName.mockResolvedValue("Retry Token");

    const spinner = createMockSpinner();
    let caught: unknown;
    try {
      await tokenCreateFlow(
        ACCOUNTS,
        SCOPES,
        USER_ID,
        "api-key",
        spinner,
        buildDeps()
      );
    } catch (error) {
      caught = error;
    }

    expect(TokenCreationFlowError.is(caught)).toBe(true);
    if (TokenCreationFlowError.is(caught)) {
      expect(caught.message).toContain("Failed after 50 attempts");
    }
    expect(spinner.stop).toHaveBeenCalledWith("Failed");
  });

  test("throws TokenCreationFlowError when all permissions become restricted", async () => {
    mockCreateToken.mockResolvedValue(
      Result.err(
        new RestrictedPermissionError({
          errorText: "DNS Read is restricted",
          permissionName: "DNS Read",
        })
      )
    );
    mockAskTokenPreset.mockResolvedValue("custom");
    mockSelectAccounts.mockResolvedValue(ACCOUNTS);
    mockSelectScopes.mockResolvedValue([CHOSEN_PERMS[0] as PermissionGroup]);
    mockAskTokenName.mockResolvedValue("Empty Token");

    const spinner = createMockSpinner();
    let caught: unknown;
    try {
      await tokenCreateFlow(
        ACCOUNTS,
        SCOPES,
        USER_ID,
        "api-key",
        spinner,
        buildDeps()
      );
    } catch (error) {
      caught = error;
    }

    expect(TokenCreationFlowError.is(caught)).toBe(true);
    if (TokenCreationFlowError.is(caught)) {
      expect(caught.message).toContain(
        "All selected permissions were restricted"
      );
    }
    expect(spinner.stop).toHaveBeenCalledWith("No permissions left to grant.");
  });
});
