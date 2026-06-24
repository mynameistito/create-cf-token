import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { Result, UnhandledException } from "better-result";

import { buildAuthTemplateUrl } from "#src/auth/template-url.ts";
import { CloudflareApiError } from "#src/errors/index.ts";
import { TokenCreationFlowError } from "#src/errors/token-creation-flow-error.ts";
import { TokenDeletionFlowError } from "#src/errors/token-deletion-flow-error.ts";
import colour from "#src/terminal/colour.ts";
import { hyperlinkUrl } from "#src/terminal/hyperlink.ts";

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];
const PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-read",
    key: "zone_dns",
    name: "Zone DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
  {
    description: "Write DNS",
    id: "perm-write",
    key: "zone_dns",
    name: "Zone DNS Write",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

const CF_API_TOKENS_URL = "https://dash.cloudflare.com/profile/api-tokens";

let capturedCancelMessage: string | undefined;

const mockCancelPrompt = mock((message: string) => {
  capturedCancelMessage = message;
});
const mockAskCredentials = mock(() =>
  Promise.resolve({ apiKey: "test-token" })
);
type PostCreateAction = "again" | "done" | "revoke-again" | "revoke-done";

const mockAskPostCreateAction = mock<() => Promise<PostCreateAction>>(() =>
  Promise.resolve("done")
);
const mockPrintNote = mock(() => {});
const mockFinishOutro = mock(() => {});
const mockLogMessageError = mock(() => {});
const mockLogMessageInfo = mock(() => {});
const mockDeleteTokens = mock(() => Promise.resolve());
const mockTokenCreateFlow = mock(() =>
  Promise.resolve({ id: "tok-1", name: "My Token", value: "secret" })
);
const mockGetUser = mock(() => Promise.resolve(Result.ok(USER_FIXTURE)));
const mockGetAccounts = mock(() =>
  Promise.resolve(Result.ok(ACCOUNTS_FIXTURE))
);
const mockGetPermissionGroups = mock(() =>
  Promise.resolve(Result.ok(PERMS_FIXTURE))
);

const spinner = {
  cancel: mock(() => {}),
  clear: mock(() => {}),
  error: mock(() => {}),
  isCancelled: false,
  message: mock(() => {}),
  start: mock(() => {}),
  stop: mock(() => {}),
};
const mockCreateSpinner = mock(() => spinner);

const indexDeps = {
  askCredentials: mockAskCredentials,
  askPostCreateAction: mockAskPostCreateAction,
  buildAuthTemplateUrl,
  cancelPrompt: mockCancelPrompt,
  createSpinner: mockCreateSpinner,
  deleteTokens: mockDeleteTokens,
  finishOutro: mockFinishOutro,
  getAccounts: mockGetAccounts,
  getPermissionGroups: mockGetPermissionGroups,
  getUser: mockGetUser,
  hyperlinkUrl,
  logMessage: {
    error: mockLogMessageError,
    info: mockLogMessageInfo,
    warn: mock(() => {}),
  },
  printNote: mockPrintNote,
  tokenCreateFlow: mockTokenCreateFlow,
};

interface RunResult {
  cancelMessage: string | undefined;
  exitCode: number | undefined;
}

class ProcessExitError extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExitError";
    this.code = code;
  }
}

async function runHandleApiError(
  error: CloudflareApiError | UnhandledException
): Promise<RunResult> {
  const { handleApiError } = await import("#src/index.ts");
  capturedCancelMessage = undefined;
  let exitCode: number | undefined;

  const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
    exitCode = code as number;
    return undefined as never;
  });

  try {
    handleApiError(error, indexDeps);
  } finally {
    exitSpy.mockRestore();
  }

  return { cancelMessage: capturedCancelMessage, exitCode };
}

afterEach(() => {
  mockAskCredentials.mockClear();
  mockAskPostCreateAction.mockClear();
  mockPrintNote.mockClear();
  mockFinishOutro.mockClear();
  mockLogMessageError.mockClear();
  mockLogMessageInfo.mockClear();
  mockDeleteTokens.mockClear();
  mockTokenCreateFlow.mockClear();
  mockGetUser.mockClear();
  mockGetAccounts.mockClear();
  mockGetPermissionGroups.mockClear();
  mockCreateSpinner.mockClear();
  mockAskCredentials.mockResolvedValue({ apiKey: "test-token" });
  mockAskPostCreateAction.mockResolvedValue("done");
  mockDeleteTokens.mockResolvedValue();
  mockTokenCreateFlow.mockResolvedValue({
    id: "tok-1",
    name: "My Token",
    value: "secret",
  });
  mockGetUser.mockResolvedValue(Result.ok(USER_FIXTURE));
  mockGetAccounts.mockResolvedValue(Result.ok(ACCOUNTS_FIXTURE));
  mockGetPermissionGroups.mockResolvedValue(Result.ok(PERMS_FIXTURE));
  indexDeps.buildAuthTemplateUrl = buildAuthTemplateUrl;
  process.exitCode = 0;
});

describe.serial("handleApiError()", () => {
  test.serial(
    "calls cancelPrompt with CloudflareApiError guidance and exits 1",
    async () => {
      const error = new CloudflareApiError({
        messages: ["Unauthorized"],
        path: "/user",
      });
      const { cancelMessage, exitCode } = await runHandleApiError(error);

      expect(cancelMessage).toContain(error.message);
      expect(cancelMessage).toContain("Your API token may be incorrect");
      expect(cancelMessage).toContain(
        `${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`
      );
      expect(exitCode).toBe(1);
    }
  );

  test.serial(
    "calls cancelPrompt with UnhandledException message and exits 1",
    async () => {
      const error = new UnhandledException({
        cause: new Error("network down"),
      });
      const { cancelMessage, exitCode } = await runHandleApiError(error);

      expect(cancelMessage).toBe(error.message);
      expect(exitCode).toBe(1);
    }
  );
});

describe.serial("main()", () => {
  test.serial(
    "orchestrates API calls and tokenCreateFlow on happy path",
    async () => {
      const { main } = await import("#src/index.ts");
      await main(indexDeps);

      expect(mockPrintNote).toHaveBeenCalled();
      expect(mockAskCredentials).toHaveBeenCalled();
      expect(mockGetUser).toHaveBeenCalledWith("test-token");
      expect(mockGetAccounts).toHaveBeenCalledWith("test-token");
      expect(mockGetPermissionGroups).toHaveBeenCalledWith("test-token");
      expect(mockTokenCreateFlow).toHaveBeenCalledTimes(1);
      expect(mockAskPostCreateAction).toHaveBeenCalled();
      expect(mockFinishOutro).toHaveBeenCalledWith("Done!");
    }
  );

  test.serial(
    "logs auth template URL when required permissions exist",
    async () => {
      indexDeps.buildAuthTemplateUrl = mock(() => "https://example.com/auth");

      const { main } = await import("#src/index.ts");
      await main(indexDeps);

      expect(mockLogMessageInfo).toHaveBeenCalledWith(
        expect.stringContaining("Auth token setup URL")
      );
      expect(mockLogMessageInfo).toHaveBeenCalledWith(
        expect.stringContaining("https://example.com/auth")
      );
    }
  );

  test.serial("exits when user lookup fails", async () => {
    mockGetUser.mockResolvedValue(
      Result.err(
        new CloudflareApiError({ messages: ["Bad token"], path: "/user" })
      ) as never
    );
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new ProcessExitError(code as number);
    });

    try {
      const { main } = await import("#src/index.ts");
      await expect(main(indexDeps)).rejects.toThrow(ProcessExitError);
    } finally {
      exitSpy.mockRestore();
    }

    expect(spinner.stop).toHaveBeenCalledWith("Failed");
    expect(mockCancelPrompt).toHaveBeenCalledWith(
      expect.stringContaining("Bad token")
    );
  });

  test.serial("exits when account lookup fails", async () => {
    mockGetAccounts.mockResolvedValue(
      Result.err(
        new CloudflareApiError({ messages: ["No accounts"], path: "/accounts" })
      ) as never
    );
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new ProcessExitError(code as number);
    });

    try {
      const { main } = await import("#src/index.ts");
      await expect(main(indexDeps)).rejects.toThrow(ProcessExitError);
    } finally {
      exitSpy.mockRestore();
    }

    expect(spinner.stop).toHaveBeenCalledWith("Failed");
    expect(mockCancelPrompt).toHaveBeenCalledWith(
      expect.stringContaining("No accounts")
    );
  });

  test.serial("exits when permission lookup fails", async () => {
    mockGetPermissionGroups.mockResolvedValue(
      Result.err(
        new CloudflareApiError({
          messages: ["No permissions"],
          path: "/user/tokens/permission_groups",
        })
      ) as never
    );
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new ProcessExitError(code as number);
    });

    try {
      const { main } = await import("#src/index.ts");
      await expect(main(indexDeps)).rejects.toThrow(ProcessExitError);
    } finally {
      exitSpy.mockRestore();
    }

    expect(spinner.stop).toHaveBeenCalledWith("Failed");
    expect(mockCancelPrompt).toHaveBeenCalledWith(
      expect.stringContaining("No permissions")
    );
  });

  test.serial("handles TokenCreationFlowError without rethrowing", async () => {
    mockTokenCreateFlow.mockImplementation(() => {
      throw new TokenCreationFlowError({ message: "flow failed" });
    });

    const { main } = await import("#src/index.ts");
    await main(indexDeps);

    expect(mockLogMessageError).toHaveBeenCalledWith("flow failed");
    expect(process.exitCode).toBe(1);
    expect(mockFinishOutro).not.toHaveBeenCalled();
  });

  test.serial("revokes the created token when requested", async () => {
    mockAskPostCreateAction.mockResolvedValue("revoke-done");

    const { main } = await import("#src/index.ts");
    await main(indexDeps);

    expect(mockDeleteTokens).toHaveBeenCalledWith(
      [{ id: "tok-1", name: "My Token", value: "secret" }],
      "test-token",
      spinner
    );
    expect(mockFinishOutro).toHaveBeenCalledWith("Done!");
  });

  test.serial("revokes previous token when creating again", async () => {
    mockAskPostCreateAction
      .mockResolvedValueOnce("revoke-again")
      .mockResolvedValueOnce("done");
    mockTokenCreateFlow
      .mockResolvedValueOnce({ id: "tok-1", name: "First", value: "secret-1" })
      .mockResolvedValueOnce({
        id: "tok-2",
        name: "Second",
        value: "secret-2",
      });

    const { main } = await import("#src/index.ts");
    await main(indexDeps);

    expect(mockTokenCreateFlow).toHaveBeenCalledTimes(2);
    expect(mockDeleteTokens).toHaveBeenCalledWith(
      [{ id: "tok-1", name: "First", value: "secret-1" }],
      "test-token",
      spinner
    );
  });

  test.serial(
    "creates another token without revoking when requested",
    async () => {
      mockAskPostCreateAction
        .mockResolvedValueOnce("again")
        .mockResolvedValueOnce("done");

      const { main } = await import("#src/index.ts");
      await main(indexDeps);

      expect(mockTokenCreateFlow).toHaveBeenCalledTimes(2);
      expect(mockDeleteTokens).not.toHaveBeenCalled();
    }
  );

  test.serial("handles TokenDeletionFlowError without rethrowing", async () => {
    mockAskPostCreateAction.mockResolvedValue("revoke-done");
    mockDeleteTokens.mockImplementation(() => {
      throw new TokenDeletionFlowError({ message: "delete failed" });
    });

    const { main } = await import("#src/index.ts");
    await main(indexDeps);

    expect(mockLogMessageError).toHaveBeenCalledWith("delete failed");
    expect(process.exitCode).toBe(1);
    expect(mockFinishOutro).not.toHaveBeenCalled();
  });
});
