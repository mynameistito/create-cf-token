import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { handleFlags } from "#src/index.ts";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const SEMVER_RE = /^\d+\.\d+\.\d+/;

async function spawnCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_ENTRY, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

function silenced<T>(fn: () => T): T {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to suppress console output during tests
  const noop = () => {};
  const orig = console.log;
  console.log = noop;
  try {
    return fn();
  } finally {
    console.log = orig;
  }
}

describe("handleFlags (unit)", () => {
  test("returns true for --help", () => {
    const original = process.argv;
    try {
      process.argv = ["bun", "cli.ts", "--help"];
      expect(silenced(() => handleFlags())).toBe(true);
    } finally {
      process.argv = original;
    }
  });

  test("returns true for -h", () => {
    const original = process.argv;
    try {
      process.argv = ["bun", "cli.ts", "-h"];
      expect(silenced(() => handleFlags())).toBe(true);
    } finally {
      process.argv = original;
    }
  });

  test("returns true for --version", () => {
    const original = process.argv;
    try {
      process.argv = ["bun", "cli.ts", "--version"];
      expect(silenced(() => handleFlags())).toBe(true);
    } finally {
      process.argv = original;
    }
  });

  test("returns true for -v", () => {
    const original = process.argv;
    try {
      process.argv = ["bun", "cli.ts", "-v"];
      expect(silenced(() => handleFlags())).toBe(true);
    } finally {
      process.argv = original;
    }
  });

  test("returns false when no flags", () => {
    const original = process.argv;
    try {
      process.argv = ["bun", "cli.ts"];
      expect(handleFlags()).toBe(false);
    } finally {
      process.argv = original;
    }
  });
});

describe("--help flag (subprocess)", () => {
  test("exits 0", async () => {
    const { exitCode } = await spawnCli(["--help"]);
    expect(exitCode).toBe(0);
  });

  test("prints Usage section", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("Usage");
  });

  test("prints Options section", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("Options");
  });

  test("prints Environment Variables section", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("Environment Variables");
  });

  test("shows --help and -h flags", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("--help");
    expect(stdout).toContain("-h");
  });

  test("shows --version and -v flags", async () => {
    const { stdout } = await spawnCli(["--help"]);
    expect(stdout).toContain("--version");
    expect(stdout).toContain("-v");
  });
});

describe("-h flag (subprocess)", () => {
  test("exits 0 and matches --help output", async () => {
    const [full, short] = await Promise.all([
      spawnCli(["--help"]),
      spawnCli(["-h"]),
    ]);
    expect(short.exitCode).toBe(0);
    expect(short.stdout).toBe(full.stdout);
  });
});

describe("--version flag (subprocess)", () => {
  test("exits 0", async () => {
    const { exitCode } = await spawnCli(["--version"]);
    expect(exitCode).toBe(0);
  });

  test("prints a semver-like version string", async () => {
    const { stdout } = await spawnCli(["--version"]);
    expect(stdout.trim()).toMatch(SEMVER_RE);
  });
});

describe("-v flag (subprocess)", () => {
  test("exits 0 and matches --version output", async () => {
    const [full, short] = await Promise.all([
      spawnCli(["--version"]),
      spawnCli(["-v"]),
    ]);
    expect(short.exitCode).toBe(0);
    expect(short.stdout).toBe(full.stdout);
  });
});
