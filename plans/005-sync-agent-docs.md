# Plan 005: Sync AGENTS.md and CONTRIBUTING to codebase

> **Drift check**: `git diff --stat fc3a338..HEAD -- AGENTS.md CONTRIBUTING.md src/AGENTS.md __tests__/AGENTS.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (README auth sync)
- **Category**: docs
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

Agent and contributor docs contradict code: wrong auth, error types, CI shape, removed symbols.

## Current state

Stale references:

- `AGENTS.md`: `CF_EMAIL`, `(email, apiKey)`, `RestrictedPermissionError`, `extractFailedPerm`, retry loop, "No tests in CI", `index.ts ~550 lines`
- `CONTRIBUTING.md:10` Global API Key; `CONTRIBUTING.md:102-106` CI only check+build
- `src/AGENTS.md`: email/apiKey credentials, error types, retry, extractFailedPerm
- `__tests__/AGENTS.md`: extractFailedPerm, CI no tests, wrong bunfig exclude pattern

Actual CI (`.github/workflows/ci.yml`): audit, build, check, knip, test, test:node, security:scan — no typecheck (plan 007).

Actual auth: Bearer `CF_API_TOKEN` only.

## Scope

**In scope**: `AGENTS.md`, `CONTRIBUTING.md`, `src/AGENTS.md`, `__tests__/AGENTS.md`

**Out of scope**: README (001), code

## Git workflow

- Branch: `fix/improve-005-agent-docs`
- Commit: `docs: sync AGENTS and CONTRIBUTING to current architecture`

## Steps

### Step 1: Update root AGENTS.md

- Remove `CF_EMAIL`, email auth, stale error types if not restored yet — **if branching from main before 002 merges, document only `CloudflareApiError` OR note 002 in progress**. Prefer documenting actual code on your branch.
- Update CI table to match `ci.yml` matrix
- Fix code map: remove `extractFailedPerm` if absent, fix `index.ts` line count (~330)
- Update process env: `CF_API_TOKEN`, `CF_API_BASE_URL` only

### Step 2: Update CONTRIBUTING.md

- Prerequisites: scoped API token not Global API Key
- CI section: list all matrix jobs
- PR checklist unchanged

### Step 3: Update src/AGENTS.md and **tests**/AGENTS.md

- Bearer auth only in api.ts description
- Error types matching `src/errors.ts` on branch
- Tests run in CI; bunfig exclude is `**/*.node.test.ts` (note `cli.node.e2e.test.ts` runs in default `bun test`)

### Step 4: Changeset

```bash
bun run changeset-add patch "Sync AGENTS.md and CONTRIBUTING to current codebase"
```

## Done criteria

- [ ] No `CF_EMAIL` or Global API Key in scoped files
- [ ] CI description matches ci.yml
- [ ] `bun run check` exit 0
- [ ] Changeset created

## STOP conditions

- Merge conflict with 001 on unrelated files — rebase onto main first.
