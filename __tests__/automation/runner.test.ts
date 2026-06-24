import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { TestServer } from "@tests/helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "@tests/helpers/test-server.ts";
import { Result, UnhandledException } from "better-result";

import {
  failIfNonInteractiveIncomplete,
  runAutomationCreate,
  runDiscovery,
  shouldRunAutomation,
} from "@/automation/runner.ts";
import { parseCliArgs } from "@/cli/args.ts";
import { CloudflareApiError } from "@/errors/cloudflare-api-error.ts";
import { RestrictedPermissionError } from "@/errors/restricted-permission-error.ts";
import { TokenCreationError } from "@/errors/token-creation-error.ts";

const USER = { email: "test@example.com", id: "user-123" };
const ACCOUNTS = [{ id: "acct-1", name: "Acme Corp" }];
const PERMS = [
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

function discoveryRoutes(): Record<string, ReturnType<typeof successResponse>> {
  return {
    "/accounts": successResponse(ACCOUNTS, {
      count: 1,
      page: 1,
      per_page: 50,
      total_count: 1,
    }),
    "/user": successResponse(USER),
    "/user/tokens/permission_groups": successResponse(PERMS),
  };
}

function parseArgs(argv: string[]) {
  const args = parseCliArgs(argv);
  if ("error" in args) {
    throw new Error(`unexpected parse error: ${args.error}`);
  }
  return args;
}

async function resolved<T>(value: T): Promise<T> {
  await Promise.resolve();
  return value;
}

function withStdinTty(tty: boolean | undefined, fn: () => void): void {
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    enumerable: ttyDescriptor?.enumerable ?? true,
    get: () => tty,
  });

  try {
    fn();
  } finally {
    if (ttyDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
    }
  }
}

function collectWrites(stream: Pick<NodeJS.WriteStream, "write">): {
  restore: () => void;
  writes: string[];
} {
  const writes: string[] = [];
  const writeSpy = spyOn(stream, "write").mockImplementation((chunk) => {
    writes.push(String(chunk));
    return true;
  });

  return {
    restore: () => {
      writeSpy.mockRestore();
    },
    writes,
  };
}

class ProcessExitError extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExitError";
    this.code = code;
  }
}

function mockProcessExit() {
  return spyOn(process, "exit").mockImplementation((code) => {
    throw new ProcessExitError(code as number);
  });
}

async function expectProcessExit(
  run: () => Promise<void>
): Promise<{ stderr: string[] }> {
  const stderr = collectWrites(process.stderr);
  const exitSpy = mockProcessExit();

  try {
    await run();
    throw new Error("expected process.exit to be called");
  } catch (error) {
    if (error instanceof ProcessExitError) {
      expect(error.code).toBe(1);
      return { stderr: stderr.writes };
    }
    throw error;
  } finally {
    stderr.restore();
    exitSpy.mockRestore();
  }
}

let previousApiToken: string | undefined;
let previousApiBaseUrl: string | undefined;
let previousNonInteractiveEnv: string | undefined;

beforeEach(() => {
  previousApiToken = process.env.CF_API_TOKEN;
  previousApiBaseUrl = process.env.CF_API_BASE_URL;
  previousNonInteractiveEnv = process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
  process.env.CF_API_TOKEN = "test-token";
});

afterEach(() => {
  if (previousApiToken === undefined) {
    delete process.env.CF_API_TOKEN;
  } else {
    process.env.CF_API_TOKEN = previousApiToken;
  }

  if (previousApiBaseUrl === undefined) {
    delete process.env.CF_API_BASE_URL;
  } else {
    process.env.CF_API_BASE_URL = previousApiBaseUrl;
  }

  if (previousNonInteractiveEnv === undefined) {
    delete process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
  } else {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = previousNonInteractiveEnv;
  }
});

describe.serial("shouldRunAutomation", () => {
  test.serial("-n alone forces automation", () => {
    const args = parseArgs(["-n"]);
    expect(args.explicitNonInteractive).toBe(true);
    expect(args.command).toBe("create");
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial(
    "env-only non-interactive without create flags does not force automation",
    () => {
      process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
      const args = parseArgs([]);
      expect(args.nonInteractive).toBe(true);
      expect(args.explicitNonInteractive).toBe(false);
      expect(args.command).toBe("interactive");
      expect(shouldRunAutomation(args)).toBe(false);
    }
  );

  test.serial("env non-interactive with --name forces automation", () => {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
    const args = parseArgs(["--name", "ci-token"]);
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial("env non-interactive with --preset forces automation", () => {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
    const args = parseArgs(["--preset", "full-access"]);
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial("env non-interactive with --scopes forces automation", () => {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
    const args = parseArgs(["--scopes", "Zone DNS:read"]);
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial("env non-interactive with --file forces automation", () => {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
    const args = parseArgs(["--file", "token.json"]);
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial("env non-interactive with --dry-run forces automation", () => {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
    const args = parseArgs(["--dry-run"]);
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test.serial(
    "env non-interactive with create flags still forces automation",
    () => {
      process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
      const args = parseArgs(["--name", "ci-token", "--preset", "full-access"]);
      expect(args.explicitNonInteractive).toBe(false);
      expect(args.command).toBe("create");
      expect(shouldRunAutomation(args)).toBe(true);
    }
  );

  test.serial(
    "-n with discovery command forces automation without create spec",
    () => {
      const args = parseArgs(["-n", "--list-scopes"]);
      expect(args.command).toBe("list-scopes");
      expect(shouldRunAutomation(args)).toBe(true);
    }
  );
});

describe.serial("failIfNonInteractiveIncomplete", () => {
  test.serial(
    "-n with discovery command does not require create spec on TTY",
    () => {
      const exitSpy = spyOn(process, "exit").mockImplementation(
        () => undefined as never
      );

      withStdinTty(true, () => {
        const args = parseArgs(["-n", "--list-scopes"]);
        failIfNonInteractiveIncomplete(args);
        expect(exitSpy).not.toHaveBeenCalled();
      });

      exitSpy.mockRestore();
    }
  );

  test.serial(
    "non-TTY create with incomplete spec exits with validation message",
    () => {
      const stderr = collectWrites(process.stderr);
      const exitSpy = mockProcessExit();

      try {
        withStdinTty(false, () => {
          process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
          const args = parseArgs(["--name", "incomplete-token"]);
          failIfNonInteractiveIncomplete(args);
        });
        throw new Error("expected process.exit to be called");
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        expect(stderr.writes.join("")).toContain(
          "Non-interactive mode requires --scopes"
        );
      } finally {
        stderr.restore();
        exitSpy.mockRestore();
      }
    }
  );

  test.serial(
    "non-TTY explicit -n with incomplete create spec exits with validation message",
    () => {
      const stderr = collectWrites(process.stderr);
      const exitSpy = mockProcessExit();

      try {
        withStdinTty(false, () => {
          const args = parseArgs(["-n", "--name", "incomplete-token"]);
          failIfNonInteractiveIncomplete(args);
        });
        throw new Error("expected process.exit to be called");
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        expect(stderr.writes.join("")).toContain(
          "Non-interactive mode requires --scopes"
        );
      } finally {
        stderr.restore();
        exitSpy.mockRestore();
      }
    }
  );

  test.serial(
    "non-TTY interactive command without automation flags exits with usage message",
    () => {
      const stderr = collectWrites(process.stderr);
      const exitSpy = mockProcessExit();

      try {
        withStdinTty(false, () => {
          const args = parseArgs([]);
          failIfNonInteractiveIncomplete(args);
        });
        throw new Error("expected process.exit to be called");
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessExitError);
        expect(stderr.writes.join("")).toContain("stdin is not a TTY");
      } finally {
        stderr.restore();
        exitSpy.mockRestore();
      }
    }
  );

  test.serial("non-TTY discovery command does not require create spec", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );

    withStdinTty(false, () => {
      process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
      const args = parseArgs(["--list-accounts"]);
      failIfNonInteractiveIncomplete(args);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    exitSpy.mockRestore();
  });
});

describe.serial("runDiscovery", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer(discoveryRoutes());
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("writes scope list for --list-scopes", async () => {
    const stdout = collectWrites(process.stdout);

    try {
      await runDiscovery(parseArgs(["--list-scopes", "--json"]));

      const output = stdout.writes.join("");
      const parsed = JSON.parse(output) as {
        scopes: { name: string }[];
      };
      expect(parsed.scopes.some((scope) => scope.name === "Zone DNS")).toBe(
        true
      );
    } finally {
      stdout.restore();
    }
  });

  test.serial("writes permission list for --list-permissions", async () => {
    const stdout = collectWrites(process.stdout);

    try {
      await runDiscovery(parseArgs(["--list-permissions", "--json"]));

      const output = stdout.writes.join("");
      const parsed = JSON.parse(output) as {
        permissions: { id: string }[];
      };
      expect(parsed.permissions.map((perm) => perm.id)).toEqual([
        "perm-read",
        "perm-write",
      ]);
    } finally {
      stdout.restore();
    }
  });

  test.serial("writes account list for --list-accounts", async () => {
    const stdout = collectWrites(process.stdout);

    try {
      await runDiscovery(parseArgs(["--list-accounts", "--json"]));

      const output = stdout.writes.join("");
      const parsed = JSON.parse(output) as {
        accounts: { id: string; name: string }[];
      };
      expect(parsed.accounts).toEqual(ACCOUNTS);
    } finally {
      stdout.restore();
    }
  });
});

describe.serial("runDiscovery — fetchAutomationContext API errors", () => {
  test.serial("exits when getUser fails", async () => {
    const server = startTestServer({
      "/user": errorResponse(["Invalid API token"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;

    try {
      const { stderr } = await expectProcessExit(async () => {
        await runDiscovery(parseArgs(["--list-scopes", "--json"]));
      });

      expect(stderr.join("")).toContain("Invalid API token");
      expect(stderr.join("")).toContain(
        "Your API token may be incorrect or missing required permissions."
      );
    } finally {
      server.stop();
      delete process.env.CF_API_BASE_URL;
    }
  });

  test.serial("exits when getAccounts fails", async () => {
    const server = startTestServer({
      "/accounts": errorResponse(["Account lookup failed"]),
      "/user": successResponse(USER),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;

    try {
      const { stderr } = await expectProcessExit(async () => {
        await runDiscovery(parseArgs(["--list-accounts", "--json"]));
      });

      expect(stderr.join("")).toContain("Account lookup failed");
    } finally {
      server.stop();
      delete process.env.CF_API_BASE_URL;
    }
  });

  test.serial("exits when getPermissionGroups fails", async () => {
    const server = startTestServer({
      "/accounts": successResponse(ACCOUNTS, {
        count: 1,
        page: 1,
        per_page: 50,
        total_count: 1,
      }),
      "/user": successResponse(USER),
      "/user/tokens/permission_groups": errorResponse([
        "Permission lookup failed",
      ]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;

    try {
      const { stderr } = await expectProcessExit(async () => {
        await runDiscovery(parseArgs(["--list-permissions", "--json"]));
      });

      expect(stderr.join("")).toContain("Permission lookup failed");
    } finally {
      server.stop();
      delete process.env.CF_API_BASE_URL;
    }
  });
});

describe.serial("runAutomationCreate", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      ...discoveryRoutes(),
      "/user/tokens": successResponse({
        id: "tok-1",
        value: "secret-value",
      }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "writes dry-run policies JSON without creating a token",
    async () => {
      const stdout = collectWrites(process.stdout);

      await runAutomationCreate(
        parseArgs([
          "-n",
          "--name",
          "dry-run-token",
          "--preset",
          "full-access",
          "--dry-run",
        ])
      );

      const output = stdout.writes.join("");
      const parsed = JSON.parse(output) as {
        policies: { permission_groups: { id: string }[] }[];
      };
      expect(parsed.policies.length).toBeGreaterThan(0);
      expect(parsed.policies[0]?.permission_groups.length).toBeGreaterThan(0);
      stdout.restore();
    }
  );

  test.serial(
    "writes JSON token output when --output json is set",
    async () => {
      const stdout = collectWrites(process.stdout);

      await runAutomationCreate(
        parseArgs([
          "-n",
          "--name",
          "json-token",
          "--preset",
          "full-access",
          "--output",
          "json",
        ])
      );

      const output = stdout.writes.join("");
      const parsed = JSON.parse(output) as {
        id: string;
        name: string;
        value: string;
      };
      expect(parsed).toEqual({
        id: "tok-1",
        name: "json-token",
        value: "secret-value",
      });
      stdout.restore();
    }
  );

  test.serial(
    "writes default token output when --output is omitted",
    async () => {
      const stdout = collectWrites(process.stdout);

      await runAutomationCreate(
        parseArgs(["-n", "--name", "text-token", "--preset", "full-access"])
      );

      const output = stdout.writes.join("");
      expect(output).toContain("Token created: text-token");
      expect(output).toContain("secret-value");
      stdout.restore();
    }
  );

  test.serial("creates a token from scope and account flags", async () => {
    const stdout = collectWrites(process.stdout);

    await runAutomationCreate(
      parseArgs([
        "-n",
        "--name",
        "scoped-token",
        "--scopes",
        "Zone DNS:read",
        "--accounts",
        "acct-1",
      ])
    );

    const output = stdout.writes.join("");
    expect(output).toContain("Token created: scoped-token");
    expect(output).toContain("secret-value");
    stdout.restore();
  });

  test.serial("prints excluded restricted permissions", async () => {
    const stdout = collectWrites(process.stdout);
    const stderr = collectWrites(process.stderr);

    await runAutomationCreate(
      parseArgs(["-n", "--name", "excluded-token", "--preset", "full-access"]),
      {
        askCredentials: () => resolved({ apiToken: "test-token" }),
        createTokenFromSpec: () =>
          resolved(
            Result.ok({
              excludedPermissions: ["Zone DNS Write"],
              policies: [],
              token: {
                id: "tok-excluded",
                name: "excluded-token",
                value: "secret-excluded",
              },
            })
          ),
        getAccounts: () => resolved(Result.ok(ACCOUNTS)),
        getPermissionGroups: () => resolved(Result.ok(PERMS)),
        getUser: () => resolved(Result.ok(USER)),
        writeStderr: (message: string) => process.stderr.write(`${message}\n`),
        writeStdout: (message: string) => process.stdout.write(message),
      }
    );

    expect(stderr.writes.join("")).toContain(
      "Excluded 1 restricted permissions"
    );
    expect(stderr.writes.join("")).toContain("Zone DNS Write");
    expect(stdout.writes.join("")).toContain("Token created: excluded-token");
    stdout.restore();
    stderr.restore();
  });

  test.serial("exits when non-interactive validation fails", async () => {
    const { stderr } = await expectProcessExit(async () => {
      await runAutomationCreate(
        parseArgs(["-n", "--name", "incomplete-token"])
      );
    });

    expect(stderr.join("")).toContain("Non-interactive mode requires --scopes");
  });

  test.serial("exits when token spec file cannot be read", async () => {
    const missingPath = path.join(
      tmpdir(),
      "create-cf-token-missing-spec.json"
    );

    const { stderr } = await expectProcessExit(async () => {
      await runAutomationCreate(parseArgs(["-n", "--file", missingPath]));
    });

    expect(stderr.join("")).toContain(
      `Token spec file not found: ${missingPath}`
    );
  });

  test.serial("exits when token spec file contains invalid JSON", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "create-cf-token-runner-"));
    const filePath = path.join(dir, "invalid-spec.json");

    try {
      await writeFile(filePath, "{not json");

      const { stderr } = await expectProcessExit(async () => {
        await runAutomationCreate(parseArgs(["-n", "--file", filePath]));
      });

      expect(stderr.join("")).toContain("Invalid JSON in token spec.");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  test.serial("reads a valid token spec file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "create-cf-token-runner-"));
    const filePath = path.join(dir, "valid-spec.json");
    const stdout = collectWrites(process.stdout);

    try {
      await writeFile(
        filePath,
        JSON.stringify({ name: "file-token", preset: "full-access" })
      );

      await runAutomationCreate(parseArgs(["-n", "--file", filePath]));

      expect(stdout.writes.join("")).toContain("Token created: file-token");
    } finally {
      stdout.restore();
      await rm(dir, { force: true, recursive: true });
    }
  });

  test.serial("rethrows non-TokenSpecError from file read", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "create-cf-token-runner-"));

    try {
      await expect(
        runAutomationCreate(parseArgs(["-n", "--file", dir]))
      ).rejects.toThrow();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  test.serial("exits with mapped createTokenFromSpec errors", async () => {
    async function expectMappedError(
      error:
        | CloudflareApiError
        | RestrictedPermissionError
        | TokenCreationError
        | UnhandledException,
      expected: string
    ): Promise<void> {
      const { stderr } = await expectProcessExit(async () => {
        await runAutomationCreate(
          parseArgs(["-n", "--name", "bad-token", "--preset", "full-access"]),
          {
            askCredentials: () => resolved({ apiToken: "test-token" }),
            createTokenFromSpec: () => resolved(Result.err(error)),
            getAccounts: () => resolved(Result.ok(ACCOUNTS)),
            getPermissionGroups: () => resolved(Result.ok(PERMS)),
            getUser: () => resolved(Result.ok(USER)),
            writeStderr: (message: string) =>
              process.stderr.write(`${message}\n`),
            writeStdout: (message: string) => process.stdout.write(message),
          }
        );
      });

      expect(stderr.join("")).toContain(expected);
    }

    await expectMappedError(
      new CloudflareApiError({ messages: ["No auth"], path: "/user" }),
      "Your API token may be incorrect"
    );
    await expectMappedError(
      new RestrictedPermissionError({
        errorText: "restricted",
        permissionName: "Zone DNS Write",
      }),
      "Restricted permission: Zone DNS Write"
    );
    await expectMappedError(
      new TokenCreationError({ errorText: "No token for you" }),
      "Error creating token:"
    );
    await expectMappedError(
      new UnhandledException({ cause: new Error("network down") }),
      "network down"
    );
  });
});
