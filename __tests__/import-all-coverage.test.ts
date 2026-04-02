import { beforeAll, expect, test } from "bun:test";

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
    files.map((relPath) => import(new URL(relPath, `file://${dir}/`).href))
  );
}

beforeAll(async () => {
  await importAllModules(`${import.meta.dir}/../src`);
});

test("sentinel", () => {
  expect(true).toBe(true);
});
