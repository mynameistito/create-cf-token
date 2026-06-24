import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SKILL_REFERENCE_FILES } from "#src/automation/paths.ts";

import type { SpawnCliFn } from "./spawn-cli.ts";
import { DIST_CLI } from "./spawn-cli.ts";
import type { TestServer } from "./test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./test-server.ts";

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };

const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];

const CLI_PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-1",
    key: "zone_dns",
    name: "DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

const AUTOMATION_PERMS_FIXTURE = [
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

const AUTH_FAILURE_RE = /token|authentication|unauthorized/iu;
const SEMVER_RE = /^\d+\.\d+\.\d+/u;
const SHEBANG_RE = /^#!/u;

function stopServer(server: TestServer | undefined): void {
  server?.stop();
}

function serverBaseUrl(server: TestServer | undefined): string {
  if (!server) {
    throw new Error("Test server was not started");
  }
  return server.baseUrl;
}

export interface E2eScenarioOptions {
  /** When true, every test in the suite is skipped. */
  skip?: boolean;
  /** Prefix for describe blocks (e.g. "dist/cli.mjs — "). */
  labelPrefix?: string;
  /**
   * Node on Windows can return a non-standard exit code when process.exit(1)
   * runs during an active clack spinner — any non-zero exit is sufficient.
   */
  lenientAuthFailureExit?: boolean;
}

function label(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}${name}` : name;
}

function skipIf(options: E2eScenarioOptions | undefined): boolean {
  return options?.skip ?? false;
}

export function registerCliCoreScenarios(
  spawnCli: SpawnCliFn,
  options?: E2eScenarioOptions
): void {
  const skip = skipIf(options);
  const prefix = options?.labelPrefix;

  describe(label(prefix, "auth failure"), () => {
    let server: TestServer | undefined;
    let baseEnv: Record<string, string>;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/user": errorResponse(["Invalid API token"], 401),
      });
      baseEnv = {
        CF_API_BASE_URL: serverBaseUrl(server),
        CF_API_TOKEN: "bad-token",
      };
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)(
      "exits with code 1 on authentication failure",
      async () => {
        const { exitCode } = await spawnCli([], baseEnv);
        if (options?.lenientAuthFailureExit) {
          expect(exitCode).not.toBe(0);
          return;
        }
        expect(exitCode).toBe(1);
      }
    );

    test.skipIf(skip)(
      "outputs an error message on authentication failure",
      async () => {
        const { stdout, stderr } = await spawnCli([], baseEnv);
        const combined = stdout + stderr;
        expect(combined.toLowerCase()).toMatch(AUTH_FAILURE_RE);
      }
    );
  });

  describe(label(prefix, "network unreachable"), () => {
    test.skipIf(skip)(
      "exits with code 1 when the API base URL is unreachable",
      async () => {
        const { exitCode } = await spawnCli([], {
          CF_API_BASE_URL: "http://127.0.0.1:1",
          CF_API_TOKEN: "any-token",
        });
        expect(exitCode).toBe(1);
      }
    );
  });

  describe(label(prefix, "cancel via closed stdin"), () => {
    let server: TestServer | undefined;
    let baseEnv: Record<string, string>;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/accounts": successResponse(ACCOUNTS_FIXTURE),
        "/user": successResponse(USER_FIXTURE),
        "/user/tokens/permission_groups": successResponse(CLI_PERMS_FIXTURE),
      });
      baseEnv = {
        CF_API_BASE_URL: serverBaseUrl(server),
        CF_API_TOKEN: "valid-token",
      };
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)(
      "exits with code 1 when stdin is closed without automation flags",
      async () => {
        const { exitCode, stderr } = await spawnCli([], baseEnv);
        expect(exitCode).toBe(1);
        expect(stderr.toLowerCase()).toMatch(/tty|automation/u);
      }
    );
  });

  describe(label(prefix, "discovery API path (auth + fetch)"), () => {
    let server: TestServer | undefined;
    let capturedAuthHeaders: string[];

    beforeAll(() => {
      if (skip) {
        return;
      }
      capturedAuthHeaders = [];
      server = startTestServer({
        "/accounts": successResponse(ACCOUNTS_FIXTURE),
        "/user": (req) => {
          capturedAuthHeaders.push(req.headers.get("authorization") ?? "");
          return successResponse(USER_FIXTURE);
        },
        "/user/tokens/permission_groups": successResponse(CLI_PERMS_FIXTURE),
      });
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)(
      "sends Authorization Bearer header to the API",
      async () => {
        await spawnCli(["--list-scopes", "--json"], {
          CF_API_BASE_URL: serverBaseUrl(server),
          CF_API_TOKEN: "my-api-token",
        });
        expect(capturedAuthHeaders.length).toBeGreaterThan(0);
        expect(capturedAuthHeaders[0]).toBe("Bearer my-api-token");
      }
    );

    test.skipIf(skip)("returns scope JSON from discovery command", async () => {
      const { stdout, exitCode } = await spawnCli(["--list-scopes", "--json"], {
        CF_API_BASE_URL: serverBaseUrl(server),
        CF_API_TOKEN: "valid-token",
      });
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as { scopes: unknown[] };
      expect(parsed.scopes.length).toBeGreaterThan(0);
    });
  });
}

export function registerCliFlagScenarios(
  spawnCli: SpawnCliFn,
  options?: E2eScenarioOptions
): void {
  const skip = skipIf(options);
  const prefix = options?.labelPrefix;

  describe(label(prefix, "flags"), () => {
    test.skipIf(skip)("--help exits 0 and prints Usage", async () => {
      const { exitCode, stdout } = await spawnCli(["--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Usage");
    });

    test.skipIf(skip)("-h output matches --help output", async () => {
      const [full, short] = await Promise.all([
        spawnCli(["--help"]),
        spawnCli(["-h"]),
      ]);
      expect(short.exitCode).toBe(0);
      expect(short.stdout).toBe(full.stdout);
    });

    test.skipIf(skip)("--version exits 0 and prints semver", async () => {
      const { exitCode, stdout } = await spawnCli(["--version"]);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(SEMVER_RE);
    });

    test.skipIf(skip)("-v output matches --version output", async () => {
      const [full, short] = await Promise.all([
        spawnCli(["--version"]),
        spawnCli(["-v"]),
      ]);
      expect(short.exitCode).toBe(0);
      expect(short.stdout).toBe(full.stdout);
    });
  });
}

export function registerDistArtifactScenarios(
  options?: Pick<E2eScenarioOptions, "skip">
): void {
  const skip = skipIf(options);

  describe("dist/cli.mjs — artifact", () => {
    test.skipIf(skip)("has shebang on first line", async () => {
      const file = Bun.file(DIST_CLI);
      const text = await file.text();
      const head = text.slice(0, 30);
      expect(head).toMatch(SHEBANG_RE);
    });
  });
}

export function registerAutomationScenarios(
  spawnCli: SpawnCliFn,
  options?: E2eScenarioOptions
): void {
  const skip = skipIf(options);
  const prefix = options?.labelPrefix;

  describe(label(prefix, "--skill flag"), () => {
    test.skipIf(skip)("exits 0 without auth", async () => {
      const { exitCode } = await spawnCli(["--skill"]);
      expect(exitCode).toBe(0);
    });

    test.skipIf(skip)("contains content from each reference file", async () => {
      const { stdout } = await spawnCli(["--skill"]);
      for (const reference of SKILL_REFERENCE_FILES) {
        expect(stdout).toContain(reference.title);
      }
      expect(stdout).toContain("SKILL — create-cf-token");
      expect(stdout).toContain("Workflow");
    });

    test.skipIf(skip)("--help skill matches --skill", async () => {
      const [skill, helpSkill] = await Promise.all([
        spawnCli(["--skill"]),
        spawnCli(["--help", "skill"]),
      ]);
      expect(helpSkill.exitCode).toBe(0);
      expect(helpSkill.stdout).toBe(skill.stdout);
    });
  });

  describe(label(prefix, "--help automation"), () => {
    test.skipIf(skip)("exits 0 and documents key flags", async () => {
      const { exitCode, stdout } = await spawnCli(["--help", "automation"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("--non-interactive");
      expect(stdout).toContain("--list-scopes");
      expect(stdout).toContain("--skill");
    });
  });

  describe(label(prefix, "default --help"), () => {
    test.skipIf(skip)("mentions automation and skill", async () => {
      const { stdout } = await spawnCli(["--help"]);
      expect(stdout).toContain("--help automation");
      expect(stdout).toContain("--skill");
    });
  });

  describe(label(prefix, "non-interactive discovery"), () => {
    let server: TestServer | undefined;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/accounts": successResponse(ACCOUNTS_FIXTURE),
        "/user": successResponse(USER_FIXTURE),
        "/user/tokens/permission_groups": successResponse(
          AUTOMATION_PERMS_FIXTURE
        ),
      });
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)("--list-scopes --json exits 0", async () => {
      const { exitCode, stdout } = await spawnCli(["--list-scopes", "--json"], {
        CF_API_BASE_URL: serverBaseUrl(server),
        CF_API_TOKEN: "valid-token",
      });
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as { scopes: unknown[] };
      expect(parsed.scopes.length).toBeGreaterThan(0);
    });

    test.skipIf(skip)("-n --list-scopes --json exits 0", async () => {
      const { exitCode, stdout } = await spawnCli(
        ["-n", "--list-scopes", "--json"],
        {
          CF_API_BASE_URL: serverBaseUrl(server),
          CF_API_TOKEN: "valid-token",
        }
      );
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as { scopes: unknown[] };
      expect(parsed.scopes.length).toBeGreaterThan(0);
    });
  });

  describe(label(prefix, "non-interactive incomplete spec on non-TTY"), () => {
    test.skipIf(skip)("fails fast with actionable error", async () => {
      const { exitCode, stderr } = await spawnCli([]);
      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/automation|non-interactive|tty/u);
    });

    test.skipIf(skip)("-n alone fails with missing --name error", async () => {
      const { exitCode, stderr } = await spawnCli(["-n"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("--name");
    });
  });

  describe(label(prefix, "non-interactive create dry-run"), () => {
    let server: TestServer | undefined;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/accounts": successResponse(ACCOUNTS_FIXTURE),
        "/user": successResponse(USER_FIXTURE),
        "/user/tokens/permission_groups": successResponse(
          AUTOMATION_PERMS_FIXTURE
        ),
      });
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)(
      "prints policies JSON without creating token",
      async () => {
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
            CF_API_BASE_URL: serverBaseUrl(server),
            CF_API_TOKEN: "valid-token",
          }
        );
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout) as { policies: unknown[] };
        expect(parsed.policies.length).toBeGreaterThan(0);
      }
    );
  });

  describe(label(prefix, "non-interactive create with output json"), () => {
    let server: TestServer | undefined;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/accounts": successResponse(ACCOUNTS_FIXTURE),
        "/user": successResponse(USER_FIXTURE),
        "/user/tokens": () =>
          successResponse({ id: "new-token-id", value: "secret-token-value" }),
        "/user/tokens/permission_groups": successResponse(
          AUTOMATION_PERMS_FIXTURE
        ),
      });
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)("emits token JSON on success", async () => {
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
          CF_API_BASE_URL: serverBaseUrl(server),
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

  describe(label(prefix, "non-interactive auth failure"), () => {
    let server: TestServer | undefined;

    beforeAll(() => {
      if (skip) {
        return;
      }
      server = startTestServer({
        "/user": errorResponse(["Invalid API token"], 401),
      });
    });

    afterAll(() => {
      if (skip) {
        return;
      }
      stopServer(server);
    });

    test.skipIf(skip)("exits 1 on list-scopes with bad token", async () => {
      const { exitCode } = await spawnCli(["--list-scopes", "--json"], {
        CF_API_BASE_URL: serverBaseUrl(server),
        CF_API_TOKEN: "bad-token",
      });
      expect(exitCode).toBe(1);
    });
  });
}
