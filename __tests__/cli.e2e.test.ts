import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const AUTH_FAILURE_RE = /token|authentication|unauthorized/iu;

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];
const PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-1",
    key: "zone_dns",
    name: "DNS Read",
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
    env: { HOME: process.env.HOME, PATH: process.env.PATH, ...env },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stderr, stdout };
}

describe("CLI e2e — auth failure", () => {
  let server: TestServer;
  let baseEnv: Record<string, string>;

  beforeAll(() => {
    server = startTestServer({
      "/user": errorResponse(["Invalid API token"], 401),
    });
    baseEnv = {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "bad-token",
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
      CF_API_BASE_URL: "http://127.0.0.1:1",
      CF_API_TOKEN: "any-token",
    });
    expect(exitCode).toBe(1);
  });
});

describe("CLI e2e — cancel via closed stdin", () => {
  let server: TestServer;
  let baseEnv: Record<string, string>;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
    baseEnv = {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "valid-token",
    };
  });

  afterAll(() => server.stop());

  test("exits with code 1 when stdin is closed without automation flags", async () => {
    const { exitCode, stderr } = await spawnCli([], baseEnv);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toMatch(/tty|automation/u);
  });
});

describe("CLI e2e — discovery API path (auth + fetch)", () => {
  let server: TestServer;
  let capturedAuthHeaders: string[];

  beforeAll(() => {
    capturedAuthHeaders = [];
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": (req) => {
        capturedAuthHeaders.push(req.headers.get("authorization") ?? "");
        return successResponse(USER_FIXTURE);
      },
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("sends Authorization Bearer header to the API", async () => {
    await spawnCli(["--list-scopes", "--json"], {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "my-api-token",
    });
    expect(capturedAuthHeaders.length).toBeGreaterThan(0);
    expect(capturedAuthHeaders[0]).toBe("Bearer my-api-token");
  });

  test("returns scope JSON from discovery command", async () => {
    const { stdout, exitCode } = await spawnCli(["--list-scopes", "--json"], {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "valid-token",
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { scopes: unknown[] };
    expect(parsed.scopes.length).toBeGreaterThan(0);
  });
});
