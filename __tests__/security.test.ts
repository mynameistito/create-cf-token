import { describe, expect, test } from "bun:test";
import path from "node:path";

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

const REQUIRED_AUTOMATION_ASSET_PATHS = [
  "assets/automation/skill.md",
  "assets/automation/references/scope-spec.md",
  "assets/automation/references/discovery-json.md",
  "assets/automation/references/token-spec-schema.md",
  "assets/automation/references/recipes.md",
  "assets/automation/references/programmatic-api.md",
  "assets/automation/references/troubleshooting.md",
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

function toPosixPath(file: string): string {
  return file.split(path.sep).join("/");
}

function globBasePath(normalized: string): string {
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

async function packagedFiles(): Promise<string[]> {
  const pkg = (await Bun.file("package.json").json()) as {
    bin?: Record<string, string>;
    files?: string[];
  };
  const files = new Set<string>(["package.json"]);

  const docChecks = await Promise.all(
    ["README.md", "README", "LICENSE", "LICENCE"].map(async (doc) => ({
      doc,
      exists: await Bun.file(doc).exists(),
    }))
  );
  for (const { doc, exists } of docChecks) {
    if (exists) {
      files.add(doc);
    }
  }

  if (pkg.bin) {
    const binChecks = await Promise.all(
      Object.values(pkg.bin).map(async (binPath) => {
        const normalized = toPosixPath(binPath);
        return {
          exists: await Bun.file(normalized).exists(),
          normalized,
        };
      })
    );
    for (const { exists, normalized } of binChecks) {
      if (exists) {
        files.add(normalized);
      }
    }
  }

  const patternChecks = await Promise.all(
    (pkg.files ?? []).map(async (pattern) => {
      const normalized = toPosixPath(pattern);
      const matches = [
        ...new Bun.Glob(`${globBasePath(normalized)}/**/*`).scanSync("."),
      ].map(toPosixPath);

      return {
        exists: await Bun.file(normalized).exists(),
        matches,
        normalized,
      };
    })
  );
  for (const { exists, matches, normalized } of patternChecks) {
    for (const match of matches) {
      files.add(match);
    }
    if (exists) {
      files.add(normalized);
    }
  }

  return [...files].toSorted();
}

function findSetupCommandOffenders(
  scanned: { file: string; text: string }[]
): string[] {
  return scanned.flatMap(({ file, text }) => {
    if (text.includes(SETUP_SCRIPT_COMMAND)) {
      return [file];
    }
    return [];
  });
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

    expect(findSetupCommandOffenders(scanned)).toEqual([]);
  });

  test("does not define package install lifecycle scripts", async () => {
    const pkg = await Bun.file("package.json").json();
    const scripts = pkg.scripts as Record<string, string> | undefined;
    const offenders = Object.keys(scripts ?? {}).filter((script) =>
      FORBIDDEN_PACKAGE_LIFECYCLE_SCRIPTS.has(script)
    );

    expect(offenders).toEqual([]);
  });

  test("does not ship known auto-executing setup payload files", async () => {
    const files = await packagedFiles();
    const offenders = files.filter((file) => FORBIDDEN_TRACKED_PATHS.has(file));

    expect(offenders).toEqual([]);
  });

  test("ships automation skill assets required by --skill", async () => {
    const files = await packagedFiles();
    const missing = REQUIRED_AUTOMATION_ASSET_PATHS.filter(
      (file) => !files.includes(file)
    );

    expect(missing).toEqual([]);
  });

  test("does not ship the removed setup payload command", async () => {
    const files = await packagedFiles();
    const scannedFiles = files.filter((file) => canExecuteSetupCommand(file));
    const scanned = await Promise.all(
      scannedFiles.map(async (file) => ({
        file,
        text: await Bun.file(path.join(".", file)).text(),
      }))
    );

    expect(findSetupCommandOffenders(scanned)).toEqual([]);
  });
});
