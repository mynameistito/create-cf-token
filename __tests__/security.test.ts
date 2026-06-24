import { describe, expect, test } from "bun:test";

const FORBIDDEN_TRACKED_PATHS = new Set([
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".cursor/rules/setup.mdc",
  ".gemini/settings.json",
  ".github/setup.js",
  ".vscode/tasks.json",
]);

const SETUP_SCRIPT_COMMAND = ["node", ".github/setup.js"].join(" ");
const FORBIDDEN_PACKAGE_LIFECYCLE_SCRIPTS = new Set([
  "install",
  "postinstall",
  "preinstall",
]);
const SETUP_COMMAND_SCAN_EXTENSIONS = [
  ".cjs",
  ".js",
  ".json",
  ".jsonc",
  ".mjs",
  ".ps1",
  ".sh",
  ".toml",
  ".ts",
  ".yaml",
  ".yml",
] as const;

function canExecuteSetupCommand(file: string): boolean {
  return SETUP_COMMAND_SCAN_EXTENSIONS.some((extension) =>
    file.endsWith(extension)
  );
}

async function trackedFiles(): Promise<string[]> {
  const proc = Bun.spawn(["git", "ls-files", "-z"], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ls-files failed: ${stderr}`);
  }

  const files = stdout.split("\0").filter(Boolean);
  const existingFiles = await Promise.all(
    files.map(async (file) => ({ exists: await Bun.file(file).exists(), file }))
  );

  return existingFiles.filter(({ exists }) => exists).map(({ file }) => file);
}

describe("security regression guard", () => {
  test("does not track known auto-executing setup payload files", async () => {
    const files = await trackedFiles();
    const offenders = files.filter((file) => FORBIDDEN_TRACKED_PATHS.has(file));

    expect(offenders).toEqual([]);
  });

  test("does not reference the removed setup payload command", async () => {
    const files = await trackedFiles();
    const scannedFiles = files.filter(
      (file) =>
        file !== "__tests__/security.test.ts" && canExecuteSetupCommand(file)
    );
    const scanned = await Promise.all(
      scannedFiles.map(async (file) => ({
        file,
        text: await Bun.file(file).text(),
      }))
    );
    const offenders = scanned.flatMap(({ file, text }) => {
      if (text.includes(SETUP_SCRIPT_COMMAND)) {
        return [file];
      }
      return [];
    });

    expect(offenders).toEqual([]);
  });

  test("does not define package install lifecycle scripts", async () => {
    const pkg = await Bun.file("package.json").json();
    const scripts = pkg.scripts as Record<string, string> | undefined;
    const offenders = Object.keys(scripts ?? {}).filter((script) =>
      FORBIDDEN_PACKAGE_LIFECYCLE_SCRIPTS.has(script)
    );

    expect(offenders).toEqual([]);
  });
});
