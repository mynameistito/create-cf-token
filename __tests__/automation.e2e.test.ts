import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { SKILL_REFERENCE_FILES } from "#src/automation-paths.ts";

import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

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

async function spawnCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
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

describe("--skill flag", () => {
  test("exits 0 without auth", async () => {
    const { exitCode } = await spawnCli(["--skill"]);
    expect(exitCode).toBe(0);
  });

  test("contains content from each reference file", async () => {
    const { stdout } = await spawnCli(["--skill"]);
    for (const reference of SKILL_REFERENCE_FILES) {
      expect(stdout).toContain(reference.title);
    }
    expect(stdout).toContain("SKILL — create-cf-token");
    expect(stdout).toContain("Workflow");
  });

  test("--help skill matches --skill", async () => {
    const [skill, helpSkill] = await Promise.all([
      spawnCli(["--skill"]),
      spawnCli(["--help", "skill"]),
    ]);
    expect(helpSkill.exitCode).toBe(0);
    expect(helpSkill.stdout).toBe(skill.stdout);
  });
});

describe("--help automation", () => {
  test("exits 0 and documents key flags", async () => {
    const { exitCode, stdout } = await spawnCli(["--help", "automation"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("--non-interactive");
    expect(stdout).toContain("--list-scopes");
    expect(stdout).toContain("--skill");
  });
});

describe("default --help", () => {
  test("mentions automation and skill", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("--help automation");
    expect(stdout).toContain("--skill");
  });
});

describe("non-interactive discovery", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("--list-scopes --json exits 0", async () => {
    const { exitCode, stdout } = await spawnCli(["--list-scopes", "--json"], {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "valid-token",
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { scopes: unknown[] };
    expect(parsed.scopes.length).toBeGreaterThan(0);
  });
});

describe("non-interactive incomplete spec on non-TTY", () => {
  test("fails fast with actionable error", async () => {
    const { exitCode, stderr } = await spawnCli([]);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toMatch(/automation|non-interactive|tty/u);
  });

  test("-n alone fails with missing --name error", async () => {
    const { exitCode, stderr } = await spawnCli(["-n"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--name");
  });
});

describe("non-interactive create dry-run", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("prints policies JSON without creating token", async () => {
    const { exitCode, stdout } = await spawnCli(
      [
        "-n",
        "--dry-run",
        "--name",
        "test",
        "--accounts",
        "acct-1",
        "--scopes",
        "Zone DNS:read",
      ],
      {
        CF_API_BASE_URL: server.baseUrl,
        CF_API_TOKEN: "valid-token",
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { policies: unknown[] };
    expect(parsed.policies.length).toBeGreaterThan(0);
  });
});

describe("non-interactive create with output json", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens": () =>
        successResponse({ id: "new-token-id", value: "secret-token-value" }),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
  });

  afterAll(() => server.stop());

  test("emits token JSON on success", async () => {
    const { exitCode, stdout } = await spawnCli(
      [
        "-n",
        "--name",
        "ci-token",
        "--accounts",
        "acct-1",
        "--scopes",
        "Zone DNS:read",
        "--output",
        "json",
      ],
      {
        CF_API_BASE_URL: server.baseUrl,
        CF_API_TOKEN: "valid-token",
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      id: string;
      name: string;
      value: string;
    };
    expect(parsed.id).toBe("new-token-id");
    expect(parsed.value).toBe("secret-token-value");
    expect(parsed.name).toBe("ci-token");
  });
});

describe("non-interactive auth failure", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user": errorResponse(["Invalid API token"], 401),
    });
  });

  afterAll(() => server.stop());

  test("exits 1 on list-scopes with bad token", async () => {
    const { exitCode } = await spawnCli(["--list-scopes", "--json"], {
      CF_API_BASE_URL: server.baseUrl,
      CF_API_TOKEN: "bad-token",
    });
    expect(exitCode).toBe(1);
  });
});
