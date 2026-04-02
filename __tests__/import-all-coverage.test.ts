import { beforeAll } from "bun:test";

const DEFAULT_EXCLUDE = [".test.ts", ".spec.ts", ".d.ts"];

export async function importAllModules(
  dir: string,
  extraExclude: string[] = []
): Promise<void> {
  const allExclude = [...DEFAULT_EXCLUDE, ...extraExclude];

  // Use Bun.Glob to find all source files recursively
  const glob = new Bun.Glob("**/*.{ts,tsx}");

  const files = [...glob.scanSync(dir)].filter(
    (file) => !allExclude.some((pattern) => file.endsWith(pattern))
  );

  // Dynamically import everything so they appear in coverage
  await Promise.all(
    files.map((relPath) => import(new URL(relPath, `file://${dir}/`).href))
  );
}

// ─────────────────────────────────────────────────────────────
// Run automatically when this file is imported
beforeAll(async () => {
  // Point to your source folder (adjust if your structure is different)
  await importAllModules(`${import.meta.dir}/../src`);
});
