# Plan 010: Remove unused showNote export

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/prompts.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Category**: tech-debt
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

`showNote` is exported but unused. Knip reports it as dead code.

## Current state

`src/prompts.ts:1357-1359`:
```typescript
export function showNote(message: string, title: string): void {
  note(message, title);
}
```

No imports of `showNote` in codebase.

## Scope

**In scope**: `src/prompts.ts`

**Out of scope**: knip config (004)

## Git workflow

- Branch: `fix/improve-010-remove-shownote`
- Commit: `chore: remove unused showNote export`

## Steps

### Step 1: Remove showNote

Delete `showNote` function and JSDoc. Keep `note` usage elsewhere intact.

**Verify**: `rg "showNote" .` → no matches (except plans/)

### Step 2: Verify + changeset

```bash
bun run typecheck
bun run check
bun test
bun run changeset-add patch "Remove unused showNote export from prompts module"
```

## Done criteria

- [ ] `showNote` removed
- [ ] All verification passes
- [ ] Changeset created

## STOP conditions

- `showNote` is imported somewhere — report and skip removal.
