# Plan 004: Add knip configuration to fix CI knip job

> **Drift check**: `git diff --stat fc3a338..HEAD -- package.json knip.json`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

`bun run knip` exits 1 (flags all `__tests__/` as unused). CI knip job fails on main.

## Current state

- `package.json` script: `"knip": "bunx knip@latest"`
- No `knip.json` or `knip` key in package.json
- CI matrix includes `knip` (`.github/workflows/ci.yml:22`)

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Knip | `bun run knip` | exit 0 |
| Lint | `bun run check` | exit 0 |

## Scope

**In scope**: `knip.json` or `knip` config in `package.json`

**Out of scope**: removing `showNote` (plan 010), source code changes unless knip requires entry config

## Git workflow

- Branch: `fix/improve-004-knip-config`
- Commit: `chore: add knip config for test files and subpath exports`

## Steps

### Step 1: Add knip.json

Configure for this CLI package:
- `entry`: `src/cli.ts`, subpath exports from `package.json` exports
- `project`: `src/**/*.ts`, `scripts/**/*.ts`
- Ignore `__tests__/**` from unused file detection OR mark as test project
- Ignore dev-only tooling if needed

Reference: https://knip.dev — use `ignoreDependencies` only if needed.

**Verify**: `bun run knip` → exit 0

### Step 2: Changeset

```bash
bun run changeset-add patch "Add knip configuration so CI knip job passes"
```

## Done criteria

- [ ] `bun run knip` exit 0
- [ ] Changeset created

## STOP conditions

- Knip still reports `showNote` unused — that's OK for this plan (plan 010 fixes); config may ignore or leave for 010.
