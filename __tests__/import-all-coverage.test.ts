import { beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_EXCLUDE = [".test.ts", ".spec.ts", ".d.ts"];

async function importAllModules(
  dir: string,
  extraExclude: string[] = []
): Promise<void> {
  const allExclude = [...DEFAULT_EXCLUDE, ...extraExclude];

  const glob = new Bun.Glob("**/*.{ts,tsx}");

  const files = [...glob.scanSync(dir)].filter(
    (file) => !allExclude.some((pattern) => file.endsWith(pattern))
  );

  await Promise.all(
    files.map((relPath) => import(pathToFileURL(join(dir, relPath)).href))
  );
}

let importError: Error | null = null;

beforeAll(async () => {
  try {
    await importAllModules(`${import.meta.dir}/../src`);
  } catch (e) {
    importError = e instanceof Error ? e : new Error(String(e));
  }
});

test("all source modules are importable", () => {
  expect(importError).toBeNull();
});
