# Plan 008: Add unit tests for scope permission building

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/prompts.ts __tests__/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 003 (read-only fix) — branch from main; if 003 not merged, implement tests for correct behavior per plan 003
- **Category**: tests
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

`prompts.ts` has ~7% line coverage. `buildPermissionsForSelection` and `groupByService` integration in scope flow lack direct tests.

## Current state

- No `__tests__/prompts*.test.ts`
- `buildPermissionsForSelection` is private in `src/prompts.ts`
- Plan 003 exports it for testing — coordinate: export if not already done on branch

## Scope

**In scope**: `src/prompts.ts` (export for test if needed), `__tests__/prompts-scope.test.ts`

**Out of scope**: Full interactive prompt E2E

## Git workflow

- Branch: `fix/improve-008-prompts-tests`
- Commit: `test: add unit tests for scope permission building`

## Steps

### Step 1: Export testable helpers

Ensure `buildPermissionsForSelection` is exported from `prompts.ts`. Add `buildScopeOptions` tests if feasible with fixture `ServiceGroup[]`.

### Step 2: Write tests

Model after `__tests__/permissions.test.ts`:

- Read+Write+Edit service: read-only vs read+write perm IDs
- Service with only read perm
- GO_BACK from access level calls reselectScopes (mock returning GO_BACK)

### Step 3: Verify + changeset

```bash
bun test __tests__/prompts-scope.test.ts
bun run typecheck
bun run check
bun run changeset-add patch "Add unit tests for scope permission selection logic"
```

## Done criteria

- [ ] New test file with ≥3 meaningful cases
- [ ] `bun test` all pass
- [ ] Changeset created

## STOP conditions

- Plan 003 already added same test file — extend rather than duplicate.
