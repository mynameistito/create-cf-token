# Plan 006: Paginate Cloudflare account listing beyond 50

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/api.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: bug
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

`getAccounts` fetches only first 50 accounts. Users with more cannot select them.

## Current state

`src/api.ts:93-97`:
```typescript
export function getAccounts(apiToken: string) {
  return cfGet<Account[]>("/accounts?per_page=50", apiToken);
}
```

Cloudflare API returns paginated results with `result_info` (page, per_page, total_count, total_pages).

## Scope

**In scope**: `src/api.ts`, `src/types.ts` (if pagination types needed), `__tests__/api.test.ts`

**Out of scope**: prompts.ts UI changes

## Git workflow

- Branch: `fix/improve-006-accounts-pagination`
- Commit: `fix: paginate account listing for users with more than 50 accounts`

## Steps

### Step 1: Implement pagination in getAccounts

Loop pages until all accounts collected:
- Use `per_page=50` and increment `page` query param
- Parse CF list response envelope (`result`, `result_info`) — may need internal type distinct from single-page `cfGet`
- Return flat `Account[]`

Check Cloudflare API docs pattern: `GET /accounts?page=N&per_page=50`

### Step 2: Add tests

In `__tests__/api.test.ts`, mock server returns page 1 with `result_info.total_pages: 2`, page 2 with remaining accounts. Assert merged list length.

Use `helpers/test-server.ts` — extend `successResponse` if needed for paginated envelope.

### Step 3: Verify + changeset

```bash
bun test __tests__/api.test.ts
bun run typecheck
bun run check
bun run changeset-add patch "Paginate Cloudflare account listing beyond the first 50 accounts"
```

## Done criteria

- [ ] getAccounts returns all pages
- [ ] New pagination test passes
- [ ] Changeset created

## STOP conditions

- CF API response shape differs from expectation — report actual response fields from test server.
