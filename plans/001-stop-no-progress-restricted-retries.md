# Plan 001: Stop no-progress restricted-permission retries

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 00442f5..HEAD -- src/automation/create.ts src/flows/interactive-create.ts __tests__/automation/create.test.ts __tests__/flows/interactive-create.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `00442f5`, 2026-06-25

## Why this matters

Both token creation retry loops retry up to 50 times after every `RestrictedPermissionError`. If Cloudflare returns a restricted permission name that is already excluded or does not correspond to any selected permission, the next request is identical to the failed request. That creates 50 avoidable API calls, slows the CLI, and can leave users with a vague "too many restricted permissions" error instead of the real no-progress condition.

## Current state

- `src/automation/create.ts` — non-interactive creation retry loop.
- `src/flows/interactive-create.ts` — interactive creation retry loop.
- `__tests__/automation/create.test.ts` — already has a 50-retry regression test for repeated restricted permissions.
- `__tests__/flows/interactive-create.test.ts` — already covers interactive retry behavior.

Current non-interactive retry logic:

```ts
// src/automation/create.ts:156-180
const maxRetries = 50;
const activeExcluded =
  excluded ?? buildTokenManagementExclusions(chosenPerms);
const policies = buildPolicies(chosenPerms, userId, accounts, activeExcluded);

// ...

RestrictedPermissionError: (error) => {
  activeExcluded.add(error.permissionName);
  return true;
},
```

Current interactive retry logic:

```ts
// src/flows/interactive-create.ts:72-107
const maxRetries = 50;
const activeExcluded =
  excluded ?? buildTokenManagementExclusions(chosenPerms);

// ...

RestrictedPermissionError: (e) => {
  activeExcluded.add(e.permissionName);
  s.message(`Attempt ${attempt} — excluded: ${e.permissionName}`);
  return true;
},
```

Existing test showing the current pathological case:

```ts
// __tests__/automation/create.test.ts:450-475
test.serial("stops retrying after 50 restricted permissions", async () => {
  const result = await createTokenFromSpec(
    {
      name: "too-many-retries-token",
      preset: "full-access",
    },
    buildContext(),
    {
      createToken: () =>
        Promise.resolve(
          Result.err(
            new RestrictedPermissionError({
              errorText: "Phantom permission is restricted",
              permissionName: "Phantom Permission",
            })
          )
        ),
    }
  );
```

Repo conventions to match:

- Keep API functions returning `Result<T, E>`; flow functions can throw flow-specific TaggedErrors inside `Result.tryPromise` blocks.
- Tests live under `__tests__/...`, mirror `src/`, and use `bun:test`.
- Prefer deps injection over module mocking for app code.
- Use `bun` commands, not `npm`, `yarn`, or `pnpm`.

## Commands you will need

| Purpose        | Command                                                                                   | Expected on success            |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------ |
| Typecheck      | `bun run typecheck`                                                                       | exit 0, no TypeScript errors   |
| Targeted tests | `bun test __tests__/automation/create.test.ts __tests__/flows/interactive-create.test.ts` | exit 0, all tests pass         |
| Full tests     | `bun test`                                                                                | exit 0, all non-e2e tests pass |
| Lint/check     | `bun run check`                                                                           | exit 0                         |

## Scope

**In scope** (the only files you should modify):

- `src/automation/create.ts`
- `src/flows/interactive-create.ts`
- `__tests__/automation/create.test.ts`
- `__tests__/flows/interactive-create.test.ts`
- `plans/README.md`

**Out of scope** (do NOT touch, even though they look related):

- `src/api/client.ts` — keep error mapping as-is; this plan only changes retry behavior after an error is mapped.
- `src/permissions/group.ts` — do not change how permission names are parsed or excluded.
- `src/policies/build.ts` — do not change policy shape.
- `package.json` — it was already modified in the worktree during audit; do not include it in this plan.

## Git workflow

- Branch: `advisor/001-stop-no-progress-restricted-retries`.
- Commit message style: conventional commits, for example `fix: stop no-progress restricted permission retries`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a no-progress guard to the non-interactive retry loop

In `src/automation/create.ts`, update the `RestrictedPermissionError` handler inside `attemptCreateWithRetry` so it detects whether adding `error.permissionName` actually changes `activeExcluded`.

Target behavior:

- Capture `const excludedBefore = activeExcluded.size` before `activeExcluded.add(error.permissionName)`.
- After adding, if `activeExcluded.size === excludedBefore`, throw `CreateFlowError` with a message that includes the permission name and explains that excluding it did not change the generated policies.
- Keep the existing retry behavior when the exclusion set grows.

Suggested message shape:

```ts
throw new CreateFlowError({
  message: `Restricted permission "${error.permissionName}" was already excluded. Aborting to avoid retrying the same token policies.`,
});
```

Do not use this exact wording if it conflicts with lint formatting, but keep the meaning and include the permission name.

**Verify**: `bun test __tests__/automation/create.test.ts` → tests may still fail until Step 2 updates expectations, but there should be no syntax errors.

### Step 2: Update non-interactive tests for the no-progress case

In `__tests__/automation/create.test.ts`, replace or adjust the existing `"stops retrying after 50 restricted permissions"` test.

The updated test should:

- Track the number of `createToken` calls with a local counter.
- Return `RestrictedPermissionError` with `permissionName: "Phantom Permission"` every time.
- Assert the result is `Err(CreateFlowError)`.
- Assert the error message contains `Phantom Permission` and a phrase such as `already excluded` or `avoid retrying`.
- Assert the call count is `2`, not `50`: the first call adds the phantom exclusion; the second call proves the generated policies did not change and aborts.

Do not assert against the full message string unless necessary; prefer `toContain`.

**Verify**: `bun test __tests__/automation/create.test.ts` → exit 0.

### Step 3: Add the same no-progress guard to the interactive retry loop

In `src/flows/interactive-create.ts`, update the `RestrictedPermissionError` handler inside `attemptCreateToken` with the same size-check pattern.

Target behavior:

- If `activeExcluded.add(e.permissionName)` does not increase the set size, call `s.stop("Failed")` before throwing `TokenCreationFlowError`.
- The thrown message should include the permission name and explain that the same policies would be retried.
- Keep the existing `s.message(...)` and retry behavior when the exclusion set grows.

**Verify**: `bun test __tests__/flows/interactive-create.test.ts` → tests may still fail until Step 4 adds/updates expectations, but there should be no syntax errors.

### Step 4: Add interactive no-progress test coverage

In `__tests__/flows/interactive-create.test.ts`, add a test near the existing `RestrictedPermissionError` tests.

The new test should:

- Use the existing `buildDeps()` pattern in this file.
- Configure `createToken` to always return `Result.err(new RestrictedPermissionError({ permissionName: "Phantom Permission", errorText: "Phantom permission is restricted" }))`.
- Run `tokenCreateFlow(...)` with fixture accounts/scopes/user/token/spinner used by neighboring tests.
- Assert it rejects with `TokenCreationFlowError`.
- Assert `createToken` was called `2` times.
- Assert the spinner was stopped with `"Failed"` before the rejection if the test helpers expose that call.

If the existing test helpers make spinner assertions awkward, keep the assertion focused on rejection and call count; do not refactor the whole test file.

**Verify**: `bun test __tests__/flows/interactive-create.test.ts` → exit 0.

### Step 5: Run the full verification gates

Run the commands in this order:

1. `bun run typecheck` → exit 0.
2. `bun test` → exit 0.
3. `bun run check` → exit 0.

Then update the row for plan 001 in `plans/README.md` from `TODO` to `DONE`.

## Test plan

- Update `__tests__/automation/create.test.ts` to prove non-interactive creation aborts after one no-progress retry instead of 50 calls.
- Add `__tests__/flows/interactive-create.test.ts` coverage for the same behavior in the interactive flow.
- Preserve existing successful retry tests that prove a newly excluded real permission still retries and succeeds.
- Verification: `bun test __tests__/automation/create.test.ts __tests__/flows/interactive-create.test.ts` → all pass.

## Done criteria

- [ ] `bun test __tests__/automation/create.test.ts __tests__/flows/interactive-create.test.ts` exits 0.
- [ ] New/updated tests assert the no-progress case calls `createToken` 2 times, not 50.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run check` exits 0.
- [ ] No files outside the in-scope list are modified (`git status --short`).
- [ ] `plans/README.md` status row for plan 001 is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The retry loops no longer use `activeExcluded` as shown in the Current state excerpts.
- The fix appears to require changing Cloudflare API error parsing in `src/api/client.ts`.
- Existing successful restricted-permission retry tests start failing and the cause is not just an expected assertion update.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Reviewers should verify that successful retry behavior still works when the excluded set grows.
- Future changes to `extractFailedPerm` or `buildPolicies` should keep the invariant that no-progress retries abort quickly.
- This plan intentionally does not change the 50-attempt cap; it only prevents identical-policy retries.
