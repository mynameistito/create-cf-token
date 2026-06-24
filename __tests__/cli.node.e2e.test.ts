import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";
import { text as streamText } from "node:stream/consumers";

import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const DIST_CLI = path.resolve(import.meta.dirname, "../dist/cli.mjs");
const distExists = existsSync(DIST_CLI);
const SEMVER_RE = /^\d+\.\d+\.\d+/u;
const SHEBANG_RE = /^#!/u;
const SPINNER_OUTPUT_RE = /authenticated|account|permission/iu;

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "My Account" }];
const PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-1",
    name: "DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

async function spawnNode(
  args: string[],
  env: Record<string, string> = {}
): Promise<SpawnResult> {
  const proc = spawn("node", [DIST_CLI, ...args], {
    env: { HOME: process.env.HOME, PATH: process.env.PATH, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const [stdout, stderr, closeEvent] = await Promise.all([
    streamText(proc.stdout),
    streamText(proc.stderr),
    once(proc, "close"),
  ]);
  const [exitCode] = closeEvent as [number | null, NodeJS.Signals | null];

  return {
    exitCode: exitCode ?? 1,
    stderr,
    stdout,
  };
}

describe("dist/cli.mjs — flags", () => {
  test.skipIf(!distExists)("--help exits 0 and prints Usage", async () => {
    const { exitCode, stdout } = await spawnNode(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage");
  });

  test.skipIf(!distExists)("-h output matches --help output", async () => {
    const [full, short] = await Promise.all([
      spawnNode(["--help"]),
      spawnNode(["-h"]),
    ]);
    expect(short.exitCode).toBe(0);
    expect(short.stdout).toBe(full.stdout);
  });

  test.skipIf(!distExists)("--version exits 0 and prints semver", async () => {
    const { exitCode, stdout } = await spawnNode(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(SEMVER_RE);
  });

  test.skipIf(!distExists)("-v output matches --version output", async () => {
    const [full, short] = await Promise.all([
      spawnNode(["--version"]),
      spawnNode(["-v"]),
    ]);
    expect(short.exitCode).toBe(0);
    expect(short.stdout).toBe(full.stdout);
  });

  test.skipIf(!distExists)(
    "dist/cli.mjs has shebang on first line",
    async () => {
      const file = Bun.file(DIST_CLI);
      const text = await file.text();
      const head = text.slice(0, 30);
      expect(head).toMatch(SHEBANG_RE);
    }
  );
});

describe("dist/cli.mjs — auth failure", () => {
  let server!: TestServer;

  beforeAll(() => {
    if (!distExists) {
      return;
    }
    server = startTestServer({
      "/user": errorResponse(["Invalid API key"], 401),
    });
  });

  afterAll(() => {
    if (!distExists) {
      return;
    }
    server.stop();
  });

  test.skipIf(!distExists)("exits 1 on authentication failure", async () => {
    const { exitCode } = await spawnNode([], {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "bad-key",
      CF_EMAIL: "test@example.com",
    });
    // process.exit(1) while a clack spinner is active can trigger a libuv
    // assertion on Windows, producing a non-standard exit code — any non-zero
    // exit code is sufficient to confirm the failure path was taken.
    expect(exitCode).not.toBe(0);
  });
});

describe("dist/cli.mjs — successful API fetch", () => {
  let server!: TestServer;

  beforeAll(() => {
    if (!distExists) {
      return;
    }
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => {
    if (!distExists) {
      return;
    }
    server.stop();
  });

  test.skipIf(!distExists)(
    "reaches prompt stage after successful API calls",
    async () => {
      const { stdout } = await spawnNode([], {
        CF_API_BASE_URL: server.baseUrl,
        CF_API_TOKEN: "valid-key",
        CF_EMAIL: "test@example.com",
      });
      // The process reaches the interactive prompt stage then exits when stdin
      // closes — the exact exit code is platform-dependent.
      expect(stdout).toMatch(SPINNER_OUTPUT_RE);
    }
  );
});
