# Plan 004: Refresh contributor docs after source restructure

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 00442f5..HEAD -- CONTRIBUTING.md AGENTS.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `00442f5`, 2026-06-25

## Why this matters

`CONTRIBUTING.md` still describes the pre-refactor flat `src/*.ts` layout and tells contributors to add errors to `src/errors.ts`, which no longer exists. This is high-friction for humans and agents because the root `AGENTS.md` and current source tree now use focused subdirectories. Updating the contributor guide prevents new code from following stale paths and reduces review churn.

## Current state

- `CONTRIBUTING.md` — stale project structure and coding convention text.
- `AGENTS.md` — current source map and conventions; use it as the source of truth.

Stale contributor docs:

````md
CONTRIBUTING.md:27-39

## Project Structure

```text
src/
  cli.ts          # Shebang entry point — parses args and runs the interactive flow
  index.ts        # Core orchestration — account/scope selection, token creation
  prompts.ts      # All interactive prompt definitions (@clack/prompts)
  permissions.ts  # Cloudflare permission definitions and groupings
  api.ts          # Cloudflare API client (token CRUD, account listing)
  types.ts        # Shared TypeScript types
  errors.ts       # Tagged error types
colour.ts       # Terminal colour helpers
```
````

Stale error guidance:

```md
CONTRIBUTING.md:53-55

- **Result types** — use `better-result` tagged errors instead of thrown exceptions. Add new error tags to `src/errors.ts`.
- **No external runtime deps** unless strictly necessary. The only runtime dependencies are `@clack/core`, `@clack/prompts`, and `better-result`.
```

Current source map from `AGENTS.md`:

```md
AGENTS.md:15-28
├── src/ # Each subdir has AGENTS.md — start at src/AGENTS.md
│ ├── cli.ts # npm bin shim → cli/run.ts
│ ├── index.ts # Interactive orchestrator + re-exports
│ ├── api/ # Cloudflare REST client (raw fetch)
│ ├── auth/ # Dashboard URL helpers
│ ├── automation/ # Non-interactive create, spec, discovery (--skill)
│ ├── cli/ # Args, flags, help, run orchestration
│ ├── errors/ # TaggedError hierarchy (per-file)
│ ├── flows/ # Interactive token-create flow
│ ├── permissions/ # groupByService, resolveFullAccessPermissions
│ ├── policies/ # buildPolicies pure function
│ ├── prompts/ # All @clack/prompts UI (flow/, primitives/, render/)
│ ├── terminal/ # ANSI colour, hyperlinks, notes
│ └── types/ # Shared interfaces
```

Repo conventions to match:

- Keep docs concise and factual.
- Use Bun in local commands.
- Mention Changesets for user-facing changes; do not advise manual version bumps.

## Commands you will need

| Purpose          | Command           | Expected on success |
| ---------------- | ----------------- | ------------------- | --- | ------ | ----------- | -------------------------------- | ---------- |
| Stale path grep  | `rg 'src/(prompts | permissions         | api | errors | colour)\.ts | src/errors\.ts' CONTRIBUTING.md` | no matches |
| Docs/style check | `bun run check`   | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `CONTRIBUTING.md`
- `plans/README.md`

**Read-only reference files**:

- `AGENTS.md`
- `src/AGENTS.md`

**Out of scope** (do NOT touch, even though they look related):

- Source files under `src/`.
- Generated `CLAUDE.md` / subdirectory `AGENTS.md` files.
- `README.md` unless the operator asks for public user docs too.
- `package.json` — it was already modified in the worktree during audit; do not include it in this plan.

## Git workflow

- Branch: `advisor/004-refresh-contributor-docs`.
- Commit message style: conventional commits, for example `docs: refresh contributor source map`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the stale Project Structure section

In `CONTRIBUTING.md`, replace the `## Project Structure` code block with the current structure from `AGENTS.md`, but keep it shorter than the full root file.

Target content should mention at least:

- `src/cli.ts` as the bin shim.
- `src/cli/` for args, flags, help, run orchestration.
- `src/api/` as the only fetch/network layer.
- `src/automation/` for non-interactive create/spec/discovery.
- `src/flows/` for interactive token-create flow.
- `src/prompts/` as the only `@clack/prompts` tree.
- `src/errors/` as per-file TaggedError hierarchy.
- `src/policies/`, `src/permissions/`, `src/types/`, and `src/terminal/`.
- `__tests__/` mirrors `src/`.

Do not paste the entire root `AGENTS.md`; this is contributor-facing documentation.

**Verify**: `rg 'prompts\.ts|permissions\.ts|api\.ts|errors\.ts|colour\.ts' CONTRIBUTING.md` → no matches.

### Step 2: Refresh stale coding convention paths

In `CONTRIBUTING.md`, update the Result/error convention line.

Replace the stale guidance:

```md
Add new error tags to `src/errors.ts`.
```

with guidance aligned to the current structure:

```md
Add new error tags under `src/errors/` and export them through `src/errors/index.ts` when they are part of the public/internal shared surface.
```

If the line gets too long, wrap it naturally in Markdown.

**Verify**: `rg 'src/errors\.ts' CONTRIBUTING.md` → no matches.

### Step 3: Add one short pointer to local agent docs

Still in `CONTRIBUTING.md`, add a concise note after the project structure or coding conventions:

```md
Each focused source directory has its own `AGENTS.md` with local conventions; read the relevant one before changing that area.
```

Keep this human-friendly; do not make `AGENTS.md` required for non-agent contributors.

**Verify**: `bun run check` → exit 0.

### Step 4: Run final docs verification

Run:

1. `rg 'src/(prompts|permissions|api|errors|colour)\.ts|src/errors\.ts' CONTRIBUTING.md` → no matches.
2. `bun run check` → exit 0.

Then update the row for plan 004 in `plans/README.md` from `TODO` to `DONE`.

## Test plan

- No runtime tests are required for this docs-only change.
- Use `rg` to prove the known stale paths are gone.
- Use `bun run check` to validate formatting/linting.

## Done criteria

- [ ] `CONTRIBUTING.md` no longer references the flat pre-refactor files `src/prompts.ts`, `src/permissions.ts`, `src/api.ts`, `src/errors.ts`, or `src/colour.ts`.
- [ ] `CONTRIBUTING.md` points contributors to the current focused directories.
- [ ] `CONTRIBUTING.md` explains that error types live under `src/errors/`.
- [ ] `bun run check` exits 0.
- [ ] No files outside the in-scope list are modified (`git status --short`).
- [ ] `plans/README.md` status row for plan 004 is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `CONTRIBUTING.md` was already substantially rewritten and no longer contains the stale excerpts.
- Root `AGENTS.md` and the live source tree disagree about the directory structure.
- `bun run check` modifies or requires modifying files outside `CONTRIBUTING.md`; do not run auto-fix for this plan.

## Maintenance notes

- Reviewers should compare the updated structure against root `AGENTS.md` and the actual `src/` tree.
- Future structural refactors should update `CONTRIBUTING.md` in the same PR as source moves.
