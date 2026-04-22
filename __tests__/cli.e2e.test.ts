import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const ERROR_OUTPUT_RE = /error|invalid|failed/i;
const AUTH_FAILURE_RE = /token|authentication|unauthorized/i;
const SPINNER_OUTPUT_RE = /authenticated|permission/i;

const USER_FIXTURE = { id: "user-123", email: "test@example.com" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];
const PERMS_FIXTURE = [
  {
    id: "perm-1",
    key: "zone_dns",
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
      "/user": errorResponse(["Invalid API token"], 401),
    });
    baseEnv = {
      CF_API_TOKEN: "bad-token",
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
    expect(combined.toLowerCase()).toMatch(AUTH_FAILURE_RE);
  });
});

describe("CLI e2e — network unreachable", () => {
  test("exits with code 1 when the API base URL is unreachable", async () => {
    const { exitCode } = await spawnCli([], {
      CF_API_TOKEN: "any-token",
      CF_API_BASE_URL: "http://127.0.0.1:1",
    });
    expect(exitCode).toBe(1);
  });
});

describe("CLI e2e — cancel via closed stdin", () => {
  let server: TestServer;
  let baseEnv: Record<string, string>;

  beforeAll(() => {
    server = startTestServer({
      "/user": successResponse(USER_FIXTURE),
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
    baseEnv = {
      CF_API_TOKEN: "valid-token",
      CF_API_BASE_URL: server.baseUrl,
    };
  });

  afterAll(() => server.stop());

  test("exits cleanly (0 or 1) when stdin is closed immediately", async () => {
    const { exitCode, stdout, stderr } = await spawnCli([], baseEnv);
    if (exitCode === 1) {
      expect(stdout + stderr).not.toMatch(ERROR_OUTPUT_RE);
    }
    expect([0, 1]).toContain(exitCode);
  });
});

describe("CLI e2e — happy API path (auth + fetch)", () => {
  let server: TestServer;
  let capturedAuthHeaders: string[];

  beforeAll(() => {
    capturedAuthHeaders = [];
    server = startTestServer({
      "/user": (req) => {
        capturedAuthHeaders.push(req.headers.get("authorization") ?? "");
        return successResponse(USER_FIXTURE);
      },
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("sends Authorization Bearer header to the API", async () => {
    await spawnCli([], {
      CF_API_TOKEN: "my-api-token",
      CF_API_BASE_URL: server.baseUrl,
    });
    expect(capturedAuthHeaders.length).toBeGreaterThan(0);
    expect(capturedAuthHeaders[0]).toBe("Bearer my-api-token");
  });

  test("reaches permission fetch stage before cancelling interactive prompts", async () => {
    const { stdout } = await spawnCli([], {
      CF_API_TOKEN: "valid-token",
      CF_API_BASE_URL: server.baseUrl,
    });
    expect(stdout).toMatch(SPINNER_OUTPUT_RE);
  });
});
