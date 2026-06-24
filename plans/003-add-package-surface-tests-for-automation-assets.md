# Plan 003: Add package-surface tests for automation skill assets

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 00442f5..HEAD -- __tests__/security.test.ts src/automation/paths.ts package.json plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `00442f5`, 2026-06-25

## Why this matters

The CLI's `--skill` feature reads bundled files from `assets/automation/`. `package.json` currently includes those assets, and `src/automation/paths.ts` assumes they exist at runtime after packaging. The security regression test already computes the package surface, but it only checks for forbidden files and commands; it does not assert that required automation skill files are actually shipped. A small package-surface test will catch accidental removal of `assets/automation` or one of the reference files before publish.

## Current state

- `src/automation/paths.ts` — defines the required skill file and reference files.
- `package.json` — ships `assets/automation` through the npm `files` list.
- `__tests__/security.test.ts` — has helper logic to compute files included by `package.json` `files`, but only tests forbidden payloads.

Required runtime files:

```ts
// src/automation/paths.ts:11-22
const SKILL_FILENAME = "skill.md";
const REFERENCES_DIR = "references";

export const SKILL_REFERENCE_FILES = [
  { file: "scope-spec.md", title: "Reference: Scope spec" },
  { file: "discovery-json.md", title: "Reference: Discovery JSON" },
  { file: "token-spec-schema.md", title: "Reference: Token spec schema" },
  { file: "recipes.md", title: "Reference: Recipes" },
  { file: "programmatic-api.md", title: "Reference: Programmatic API" },
  { file: "troubleshooting.md", title: "Reference: Troubleshooting" },
] as const;
```

Current package manifest surface:

```json
// package.json:24-28
"files": [
  "dist",
  "assets/automation",
  "assets/token-spec.schema.json"
]
```

Existing package-surface helper:

```ts
// __tests__/security.test.ts:70-129
async function packagedFiles(): Promise<string[]> {
  const pkg = (await Bun.file("package.json").json()) as {
    bin?: Record<string, string>;
    files?: string[];
  };
  // expands package.json files entries into a sorted file list
}
```

Repo conventions to match:

- Security/package regression tests belong in `__tests__/security.test.ts`.
- Use `bun:test`; do not introduce Jest/Vitest.
- Keep tests read-only; do not run `npm pack` or write artifacts.

## Commands you will need

| Purpose                 | Command                               | Expected on success |
| ----------------------- | ------------------------------------- | ------------------- |
| Targeted security tests | `bun test __tests__/security.test.ts` | exit 0              |
| Typecheck               | `bun run typecheck`                   | exit 0              |
| Full tests              | `bun test`                            | exit 0              |
| Lint/check              | `bun run check`                       | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `__tests__/security.test.ts`
- `plans/README.md`

**Read-only reference files** (read if needed, but do not modify for this plan):

- `src/automation/paths.ts`
- `package.json`
- `assets/automation/**`

**Out of scope** (do NOT touch, even though they look related):

- `package.json` — it was already modified in the worktree during audit; this plan should add tests only.
- `src/automation/paths.ts` — do not change path resolution in this test-only plan.
- `assets/automation/**` — do not edit skill content.

## Git workflow

- Branch: `advisor/003-package-surface-automation-assets`.
- Commit message style: conventional commits, for example `test: assert automation skill assets are packaged`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add expected automation asset paths to the security test

In `__tests__/security.test.ts`, add a small constant near the existing constants:

```ts
const REQUIRED_AUTOMATION_ASSET_PATHS = [
  "assets/automation/skill.md",
  "assets/automation/references/scope-spec.md",
  "assets/automation/references/discovery-json.md",
  "assets/automation/references/token-spec-schema.md",
  "assets/automation/references/recipes.md",
  "assets/automation/references/programmatic-api.md",
  "assets/automation/references/troubleshooting.md",
] as const;
```

Keep the list explicit. Do not import `SKILL_REFERENCE_FILES` from `src/automation/paths.ts`; this test should catch drift between runtime assumptions and packaged files, and importing the source constant can hide packaging mistakes.

**Verify**: `bun test __tests__/security.test.ts` → exit 0 or a focused failure from the new test after Step 2 is added.

### Step 2: Assert the package surface includes all required skill assets

Add a test in the existing `describe("security regression guard", ...)` block:

```ts
test("ships automation skill assets required by --skill", async () => {
  const files = await packagedFiles();
  const missing = REQUIRED_AUTOMATION_ASSET_PATHS.filter(
    (file) => !files.includes(file)
  );

  expect(missing).toEqual([]);
});
```

Place it near the other package-surface tests (`does not ship known...`) so future maintainers see these checks together.

**Verify**: `bun test __tests__/security.test.ts` → exit 0.

### Step 3: Run the full verification gates

Run the commands in this order:

1. `bun run typecheck` → exit 0.
2. `bun test` → exit 0.
3. `bun run check` → exit 0.

Then update the row for plan 003 in `plans/README.md` from `TODO` to `DONE`.

## Test plan

- Add one test to `__tests__/security.test.ts` that uses the existing `packagedFiles()` helper.
- The test should fail if `package.json` stops including `assets/automation` or if an individual required reference file is removed.
- Verification: `bun test __tests__/security.test.ts` → all tests pass.

## Done criteria

- [ ] `__tests__/security.test.ts` includes `REQUIRED_AUTOMATION_ASSET_PATHS` with all current `--skill` files.
- [ ] A package-surface test asserts none of those paths are missing from `packagedFiles()`.
- [ ] `bun test __tests__/security.test.ts` exits 0.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run check` exits 0.
- [ ] No files outside the in-scope list are modified (`git status --short`).
- [ ] `plans/README.md` status row for plan 003 is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The required automation asset list in `src/automation/paths.ts` changed since the Current state excerpt; refresh this plan before implementing.
- `packagedFiles()` no longer exists or no longer computes `package.json` `files` entries.
- The test fails because a required asset is genuinely missing; report the missing path instead of editing assets or `package.json` under this plan.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- If a future change adds a new `SKILL_REFERENCE_FILES` entry, reviewers should require the explicit test list to be updated in the same PR.
- This test intentionally duplicates the required paths rather than importing source constants, because packaging regressions are most useful when checked from an external consumer perspective.
