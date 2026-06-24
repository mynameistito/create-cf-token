# Plan 002: Move Clack cancellation detection behind prompts boundary

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 00442f5..HEAD -- src/index.ts src/prompts/guards.ts src/prompts/index.ts __tests__/cli/handle-cli-error.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `00442f5`, 2026-06-25

## Why this matters

The repository documents a strict boundary: all `@clack/prompts` imports should live under `src/prompts/`. `src/index.ts` currently imports `isCancel` directly from `@clack/prompts`, which makes the top-level orchestrator depend on the prompt library internals and weakens the boundary future contributors are told to follow. Moving cancellation detection behind `src/prompts/guards.ts` keeps behavior unchanged while making the architecture match the documented convention.

## Current state

- `src/index.ts` — top-level interactive orchestrator; currently imports `isCancel` directly.
- `src/prompts/guards.ts` — already wraps Clack cancellation behavior.
- `src/prompts/index.ts` — prompt barrel used by orchestrators.
- `__tests__/cli/handle-cli-error.test.ts` — tests `handleCliError` behavior.

Boundary rule from `AGENTS.md`:

```md
AGENTS.md:76-78

- **UI isolation**: `@clack/prompts` only under `src/prompts/`. `terminal/` for raw ANSI/hyperlinks. `cli/help.ts` may use `console.log` for --help/--version.
```

Current direct import outside `src/prompts/`:

```ts
// src/index.ts:11
import { isCancel } from "@clack/prompts";
```

Current cancellation handling:

```ts
// src/index.ts:111-114
export function handleCliError(err: unknown): never {
  if (isCancel(err)) {
    process.exit(0);
  }
```

Existing prompt guard module:

```ts
// src/prompts/guards.ts:1
import { cancel, isCancel } from "@clack/prompts";
```

Repo conventions to match:

- `src/prompts/index.ts` is the allowed orchestrator import surface for prompt helpers.
- Keep `handleCliError` exported from `src/index.ts` for existing tests and callers.
- Do not add new barrel files.

## Commands you will need

| Purpose        | Command                                                                            | Expected on success                 |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| Boundary grep  | `rg '@clack/prompts' src --glob '*.ts'`                                            | no matches outside `src/prompts/**` |
| Targeted tests | `bun test __tests__/cli/handle-cli-error.test.ts __tests__/prompts/guards.test.ts` | exit 0                              |
| Typecheck      | `bun run typecheck`                                                                | exit 0                              |
| Full tests     | `bun test`                                                                         | exit 0                              |
| Lint/check     | `bun run check`                                                                    | exit 0                              |

## Scope

**In scope** (the only files you should modify):

- `src/index.ts`
- `src/prompts/guards.ts`
- `src/prompts/index.ts`
- `__tests__/cli/handle-cli-error.test.ts`
- `plans/README.md`

**Out of scope** (do NOT touch, even though they look related):

- `src/cli/run.ts` — keep top-level `.catch(handleCliError)` behavior unchanged.
- Other prompt flow files — they are already under `src/prompts/` and may import `@clack/prompts` directly.
- `package.json` — it was already modified in the worktree during audit; do not include it in this plan.

## Git workflow

- Branch: `advisor/002-move-clack-cancel-boundary`.
- Commit message style: conventional commits, for example `refactor: keep clack cancel detection inside prompts`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export a prompt-boundary cancellation helper

In `src/prompts/guards.ts`, add and export a small function that wraps Clack's `isCancel`.

Target shape:

```ts
export function isPromptCancel(value: unknown): boolean {
  return isCancel(value);
}
```

Keep existing guard behavior unchanged.

**Verify**: `bun test __tests__/prompts/guards.test.ts` → exit 0.

### Step 2: Re-export the helper from the prompt index

In `src/prompts/index.ts`, export `isPromptCancel` from `src/prompts/guards.ts` using the existing export style in that file.

Do not create a new barrel file.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Replace the direct Clack import in `src/index.ts`

In `src/index.ts`:

- Remove `import { isCancel } from "@clack/prompts";`.
- Add `isPromptCancel` to the existing import from `@/prompts/index.ts`.
- Change `if (isCancel(err))` to `if (isPromptCancel(err))`.

Behavior must remain the same: prompt cancellation exits with code 0.

**Verify**: `bun test __tests__/cli/handle-cli-error.test.ts` → exit 0.

### Step 4: Add or adjust a boundary regression assertion

If `__tests__/cli/handle-cli-error.test.ts` already covers prompt cancellation, keep it focused on behavior. Add a small test only if needed to ensure the cancellation path still exits 0.

Then manually run:

```powershell
rg '@clack/prompts' src --glob '*.ts'
```

Expected result: matches only under `src/prompts/**`. If `src/index.ts` appears in the output, this plan is not done.

**Verify**: `bun test __tests__/cli/handle-cli-error.test.ts __tests__/prompts/guards.test.ts` → exit 0.

### Step 5: Run the full verification gates

Run the commands in this order:

1. `bun run typecheck` → exit 0.
2. `bun test` → exit 0.
3. `bun run check` → exit 0.

Then update the row for plan 002 in `plans/README.md` from `TODO` to `DONE`.

## Test plan

- Existing `handleCliError` tests should continue proving cancel exits 0 and non-cancel errors exit 1.
- Existing `prompts/guards` tests should continue proving guard behavior.
- Manual boundary grep verifies `@clack/prompts` imports stay inside `src/prompts/**`.

## Done criteria

- [ ] `src/index.ts` has no `@clack/prompts` import.
- [ ] `rg '@clack/prompts' src --glob '*.ts'` returns matches only in `src/prompts/**`.
- [ ] `bun test __tests__/cli/handle-cli-error.test.ts __tests__/prompts/guards.test.ts` exits 0.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run check` exits 0.
- [ ] No files outside the in-scope list are modified (`git status --short`).
- [ ] `plans/README.md` status row for plan 002 is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `src/prompts/index.ts` no longer re-exports guard utilities or has been removed.
- `handleCliError` has moved out of `src/index.ts`.
- The cancellation tests require mocking `@clack/prompts` directly from `src/index.ts`; that would indicate a different architecture than this plan assumes.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Reviewers should check that this is a pure boundary refactor with no behavior change.
- Future orchestrator code should import prompt-related helpers from `@/prompts/index.ts`, not directly from `@clack/prompts`.
