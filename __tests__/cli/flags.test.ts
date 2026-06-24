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

import {
  startTestServer,
  successResponse,
} from "@tests/helpers/test-server.ts";
import type { TestServer } from "@tests/helpers/test-server.ts";

import {
  handleFlags,
  handleSkillFlag,
  parseArgv,
  runAutomationIfNeeded,
} from "@/index.ts";

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

function noop(): void {
  return undefined;
}

function silenced<T>(fn: () => T): T {
  const orig = console.log;
  console.log = noop;
  try {
    return fn();
  } finally {
    console.log = orig;
  }
}

describe.serial("handleFlags (unit)", () => {
  test.serial("returns true for --help", () => {
    expect(silenced(() => handleFlags(["--help"]))).toBe(true);
  });

  test.serial("returns true for -h", () => {
    expect(silenced(() => handleFlags(["-h"]))).toBe(true);
  });

  test.serial("returns true for --help automation", () => {
    expect(silenced(() => handleFlags(["--help", "automation"]))).toBe(true);
  });

  test.serial("returns true for --version", () => {
    expect(silenced(() => handleFlags(["--version"]))).toBe(true);
  });

  test.serial("returns true for -v", () => {
    expect(silenced(() => handleFlags(["-v"]))).toBe(true);
  });

  test.serial("returns false for --skill (handled by handleSkillFlag)", () => {
    expect(handleFlags(["--skill"])).toBe(false);
  });

  test.serial("returns false when no flags", () => {
    expect(handleFlags([])).toBe(false);
  });

  test.serial("unknown flag writes to stderr and exits 1", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );

    try {
      handleFlags(["--unknown-flag"]);
      expect(errorSpy).toHaveBeenCalledWith("Unknown argument: --unknown-flag");
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});

describe.serial("handleSkillFlag()", () => {
  test.serial("returns true and prints skill output for --skill", async () => {
    const originalArgv = process.argv;
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    try {
      process.argv = ["bun", "cli.ts", "--skill"];
      const handled = await handleSkillFlag();
      expect(handled).toBe(true);
      expect(logSpy).toHaveBeenCalled();
      const output = String(logSpy.mock.calls[0]?.[0] ?? "");
      expect(output).toContain("SKILL");
    } finally {
      process.argv = originalArgv;
      logSpy.mockRestore();
    }
  });

  test.serial("returns false when --skill is not present", async () => {
    const originalArgv = process.argv;
    try {
      process.argv = ["bun", "cli.ts"];
      expect(await handleSkillFlag()).toBe(false);
    } finally {
      process.argv = originalArgv;
    }
  });
});

describe.serial("parseArgv()", () => {
  test.serial("re-exports parseCliArgs", () => {
    const result = parseArgv(["--help"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("help");
    }
  });
});

describe.serial("runAutomationIfNeeded()", () => {
  let server: TestServer;
  let previousApiToken: string | undefined;
  let previousBaseUrl: string | undefined;
  let stdoutChunks: string[];

  beforeAll(() => {
    previousApiToken = process.env.CF_API_TOKEN;
    previousBaseUrl = process.env.CF_API_BASE_URL;
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE, {
        count: 1,
        page: 1,
        per_page: 50,
        total_count: 1,
      }),
      "/user": successResponse(USER_FIXTURE),
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
    process.env.CF_API_TOKEN = "automation-test-token";
  });

  afterAll(() => {
    server.stop();
    if (previousBaseUrl === undefined) {
      delete process.env.CF_API_BASE_URL;
    } else {
      process.env.CF_API_BASE_URL = previousBaseUrl;
    }
    if (previousApiToken === undefined) {
      delete process.env.CF_API_TOKEN;
    } else {
      process.env.CF_API_TOKEN = previousApiToken;
    }
  });

  beforeEach(() => {
    stdoutChunks = [];
    spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    (process.stdout.write as ReturnType<typeof spyOn>).mockRestore();
  });

  test.serial("runs discovery for --list-scopes --json", async () => {
    const handled = await runAutomationIfNeeded(["--list-scopes", "--json"]);
    expect(handled).toBe(true);

    const output = stdoutChunks.join("");
    const parsed = JSON.parse(output) as { scopes: { name: string }[] };
    expect(parsed.scopes.length).toBeGreaterThan(0);
  });

  test.serial("runs automation create dry-run path", async () => {
    const handled = await runAutomationIfNeeded([
      "-n",
      "--name",
      "ci-token",
      "--preset",
      "full-access",
      "--dry-run",
    ]);
    expect(handled).toBe(true);

    const output = stdoutChunks.join("");
    const parsed = JSON.parse(output) as { policies: unknown[] };
    expect(parsed.policies.length).toBeGreaterThan(0);
  });

  test.serial("parse error writes to stderr and exits 1", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );

    try {
      await runAutomationIfNeeded(["--format", "invalid"]);
      expect(errorSpy).toHaveBeenCalledWith(
        "Missing or invalid value for --format (expected json or table)"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
