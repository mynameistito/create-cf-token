import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const ERROR_OUTPUT_RE = /error|invalid|failed|key/i;
const SPINNER_OUTPUT_RE = /authenticated|account|permission/i;

const USER_FIXTURE = { id: "user-123", email: "test@example.com" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "My Account" }];
const PERMS_FIXTURE = [
  {
    id: "perm-1",
    name: "DNS Read",
    description: "Read DNS",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

async function spawnCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<SpawnResult> {
  const proc = Bun.spawn(["bun", CLI_ENTRY, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("CLI e2e — auth failure", () => {
  let server: TestServer;
  let baseEnv: Record<string, string>;

  beforeAll(() => {
    server = startTestServer({
      "/user": errorResponse(["Invalid API key"], 401),
    });
    baseEnv = {
      CF_EMAIL: "test@example.com",
      CF_API_TOKEN: "bad-key",
      CF_API_BASE_URL: server.baseUrl,
    };
  });

  afterAll(() => server.stop());

  test("exits with code 1 on authentication failure", async () => {
    const { exitCode } = await spawnCli([], baseEnv);
    expect(exitCode).toBe(1);
  });

  test("outputs an error message on authentication failure", async () => {
    const { stdout, stderr } = await spawnCli([], baseEnv);
    const combined = stdout + stderr;
    // clack logs errors to stdout via log.error
    expect(combined.toLowerCase()).toMatch(ERROR_OUTPUT_RE);
  });
});

describe("CLI e2e — network unreachable", () => {
  test("exits with code 1 when the API base URL is unreachable", async () => {
    const { exitCode } = await spawnCli([], {
      CF_EMAIL: "test@example.com",
      CF_API_TOKEN: "any-key",
      CF_API_BASE_URL: "http://127.0.0.1:1",
    });
    expect(exitCode).toBe(1);
  });
});

describe("CLI e2e — cancel via closed stdin", () => {
  let server: TestServer;
  let baseEnv: Record<string, string>;

  beforeAll(() => {
    // Server returns success for /user so we get past auth to the interactive prompts
    server = startTestServer({
      "/user": successResponse(USER_FIXTURE),
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
    baseEnv = {
      CF_EMAIL: "test@example.com",
      CF_API_TOKEN: "valid-key",
      CF_API_BASE_URL: server.baseUrl,
    };
  });

  afterAll(() => server.stop());

  test("exits cleanly (0 or 1) when stdin is closed immediately", async () => {
    // @clack/prompts cancels when stdin closes without input
    const { exitCode, stdout, stderr } = await spawnCli([], baseEnv);
    if (exitCode === 1) {
      expect(stdout + stderr).not.toMatch(ERROR_OUTPUT_RE);
    }
    expect([0, 1]).toContain(exitCode);
  });
});

describe("CLI e2e — happy API path (auth + fetch)", () => {
  let server: TestServer;
  let authCalls: string[];

  beforeAll(() => {
    authCalls = [];
    server = startTestServer({
      "/user": (req) => {
        authCalls.push(req.headers.get("x-auth-email") ?? "");
        return successResponse(USER_FIXTURE);
      },
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("sends correct auth headers to the API", async () => {
    await spawnCli([], {
      CF_EMAIL: "my@email.com",
      CF_API_TOKEN: "my-api-key",
      CF_API_BASE_URL: server.baseUrl,
    });
    expect(authCalls[0]).toBe("my@email.com");
  });

  test("reaches account fetch stage before cancelling interactive prompts", async () => {
    // If the process reaches the interactive select stage it means auth + accounts + perms all succeeded
    const { stdout } = await spawnCli([], {
      CF_EMAIL: "test@example.com",
      CF_API_TOKEN: "valid-key",
      CF_API_BASE_URL: server.baseUrl,
    });
    // clack spinner text appears on stdout
    expect(stdout).toMatch(SPINNER_OUTPUT_RE);
  });
});
