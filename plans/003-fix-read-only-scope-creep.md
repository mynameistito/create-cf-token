# Plan 003: Fix read-only scope selection granting Edit permissions

> **Drift check**: `git diff --stat fc3a338..HEAD -- src/prompts.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Category**: security
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

When a service has Read + Write permissions, user can pick "Read only" but `otherPerms` (including Edit) are always added unconditionally — tokens broader than user intent.

## Current state

`src/prompts.ts:1213-1237` in `buildPermissionsForSelection`:

```typescript
chosen.push(...service.otherPerms);  // always, before access level
// ...
chosen.push(service.readPerm);
if (level === "write") {
  chosen.push(service.writePerm);
}
```

`permissions.test.ts` puts "DNS Edit" in `otherPerms` when grouping DNS Read/Write/Edit.

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun test __tests__/permissions.test.ts` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run check` | exit 0 |

## Scope

**In scope**: `src/prompts.ts`, `__tests__/prompts-scope.test.ts` (create)

**Out of scope**: `buildPolicies`, README

## Git workflow

- Branch: `fix/improve-003-read-only-scope`
- Commit: `fix: exclude edit permissions when read-only access selected`

## Steps

### Step 1: Fix permission collection logic

Only include `otherPerms` when access level is write, OR when service has no read/write pair (existing branch at line 1215). For read-only selection, include only `readPerm`. For read+write, include `readPerm`, `writePerm`, and `otherPerms` (edit).

When service lacks read/write pair, keep current behavior (include available perms).

Export `buildPermissionsForSelection` for testing OR test via a thin exported helper — prefer exporting internal function as `export function buildPermissionsForSelection` for unit testing (already a module-level function).

### Step 2: Add unit tests

Create `__tests__/prompts-scope.test.ts`:
- Service with Read+Write+Edit: read-only → only read perm ID
- Service with Read+Write+Edit: read+write → read + write + edit
- Service with only Read → read included

Mock `selectWithBack` by testing `buildPermissionsForSelection` directly with a stub `reselectScopes`.

### Step 3: Changeset

```bash
bun run changeset-add patch "Fix read-only scope selection including Edit-class permissions"
```

## Done criteria

- [ ] Read-only path excludes `otherPerms`
- [ ] New tests pass; `bun test` exit 0
- [ ] Changeset created

## STOP conditions

- `buildPermissionsForSelection` signature changed in drift — re-read file before editing.
