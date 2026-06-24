# Plan 002: Restore restricted-permission retry and session token revoke

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

README and CHANGELOG advertise auto-retry on restricted permissions and session revoke/cleanup. These were removed in commit `3d3966e` during the Bearer auth migration. Users expect the behavior.

## Current state

- `src/index.ts:220-228` — single `createToken` call, no retry loop.
- `src/prompts.ts:1308-1317` — post-create only "Done" / "Create another".
- `src/errors.ts` — only `CloudflareApiError`.
- `src/permissions.ts` — no `extractFailedPerm`.
- `src/api.ts` — no `deleteToken`.

**Reference (pre-migration, adapt to Bearer auth)**: `git show 3d3966e^:src/api.ts`, `git show 3d3966e^:src/errors.ts`, `git show 3d3966e^:src/permissions.ts`, `git show 3d3966e^:src/index.ts`

Conventions:

- Errors: `TaggedError` via `better-result` — see current `src/errors.ts` pattern (`createTaggedError`).
- API: Bearer token only — see `src/api.ts` `authHeaders(apiToken)`.
- UI only in `prompts.ts`.

## Commands

| Purpose   | Command             | Expected |
| --------- | ------------------- | -------- |
| Tests     | `bun test`          | all pass |
| Typecheck | `bun run typecheck` | exit 0   |
| Lint      | `bun run check`     | exit 0   |

## Scope

**In scope**: `src/errors.ts`, `src/permissions.ts`, `src/api.ts`, `src/index.ts`, `src/prompts.ts`, `__tests__/errors.test.ts`, `__tests__/permissions.test.ts`, `__tests__/api.test.ts`, new tests as needed

**Out of scope**: README (plan 001), AGENTS.md (plan 005)

## Git workflow

- Branch: `fix/improve-002-retry-revoke`
- Commit style: `feat: restore token retry and session revoke`

## Steps

### Step 1: Restore error types

Add `TokenCreationError`, `TokenDeletionError`, `RestrictedPermissionError` using `createTaggedError` pattern matching `CloudflareApiError`. Port from `git show 3d3966e^:src/errors.ts`.

Add tests in `__tests__/errors.test.ts` modeled on existing `CloudflareApiError` tests.

### Step 2: Restore extractFailedPerm

Port `extractFailedPerm` and helpers from `git show 3d3966e^:src/permissions.ts`. Add unit tests (port from same commit's `__tests__/permissions.test.ts` if present, else write cases for quoted/unquoted permission names).

### Step 3: Harden createToken + add deleteToken

- Update `createToken` POST handler to parse response text safely (like old `tryParseJson`), distinguish restricted permission errors via `extractFailedPerm` → throw `RestrictedPermissionError`, other failures → `TokenCreationError`.
- Add `deleteToken(tokenId, apiToken)` using `DELETE /user/tokens/:id` with Bearer auth.
- Add api tests using `__tests__/helpers/test-server.ts` pattern.

### Step 4: Retry loop in index.ts

In `tokenCreateFlow`, wrap creation in `attemptCreateToken` pattern (max 50 retries):

- Track `excluded` permission IDs in a Set
- Filter policies to exclude restricted perms on retry
- On `RestrictedPermissionError`, warn via `logMessage.warn`, retry
- On other errors, `handleApiError`

### Step 5: Session revoke in prompts + index

- Track created token IDs in session array in `main()` or `tokenCreateFlow`
- Expand `askPostCreateAction` options: Done, Create another, Revoke and finish, Revoke and create another (match CHANGELOG v1.0.0)
- On revoke paths, call `deleteToken`, handle `TokenDeletionError`
- On exit with kept tokens, optional cleanup prompt for session tokens

### Step 6: Changeset

```bash
bun run changeset-add minor "Restore restricted-permission retry and session token revoke flows"
```

## Done criteria

- [ ] `bun test` passes with new retry/revoke/extractFailedPerm tests
- [ ] `bun run typecheck` and `bun run check` pass
- [ ] `rg "deleteToken" src/api.ts` matches export
- [ ] Changeset created (minor)

## STOP conditions

- Pre-migration code structure incompatible with current `index.ts` flow — report with diff summary, do not half-implement.
