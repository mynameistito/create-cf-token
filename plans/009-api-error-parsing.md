# Plan 009: Harden API JSON error parsing

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/api.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

`cfGet`/`cfPost` call `json.errors.map()` without guarding missing `errors` or non-JSON bodies.

## Current state

`src/api.ts:59-67` and `:139-147` — parse JSON, check `success`, map `json.errors` unguarded.

Pre-migration had `tryParseJson` helper in api.ts (see `git show 3d3966e^:src/api.ts`).

## Scope

**In scope**: `src/api.ts`, `__tests__/api.test.ts`

**Out of scope**: createToken restricted-perm logic (plan 002 may overlap — if 002 merges first, build on its parsing)

## Git workflow

- Branch: `fix/improve-009-api-error-parsing`
- Commit: `fix: harden Cloudflare API error response parsing`

## Steps

### Step 1: Add safe parsing helper

Add `tryParseJson<T>(text: string): T | null` internal helper.

Update `cfGet` and `cfPost`:

- Read `res.text()` first
- Parse safely; on failure throw `CloudflareApiError` with message like "Invalid JSON response"
- Use `(json.errors ?? []).map(...)`
- Optionally include HTTP status in error when `!res.ok`

Match `better-result` patterns — throw `CloudflareApiError` inside try, caught by existing catch.

### Step 2: Add tests

- Mock server returns 502 with HTML body → `UnhandledException` or `CloudflareApiError`, not throw from `.map`
- Mock returns `{ success: false }` without errors array → empty messages

### Step 3: Changeset

```bash
bun run changeset-add patch "Harden Cloudflare API error response parsing for malformed bodies"
```

## Done criteria

- [ ] No unguarded `json.errors.map`
- [ ] New tests pass; `bun test` exit 0
- [ ] Changeset created

## STOP conditions

- Plan 002 already refactored cfPost — merge/rebase and apply only missing guards.
