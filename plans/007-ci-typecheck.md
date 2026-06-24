# Plan 007: Add typecheck to CI matrix

> **Drift check**: `git diff --stat fc3a338..HEAD -- .github/workflows/ci.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: dx
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

CI runs `check` (ultracite only) but not `typecheck`. Type errors can slip through without lefthook.

## Current state

`.github/workflows/ci.yml` matrix: audit, build, check, knip, test, test:node, security:scan — no typecheck.

`package.json`: `"typecheck": "tsgo --noEmit"`

## Scope

**In scope**: `.github/workflows/ci.yml`

**Out of scope**: lefthook.yml, package.json scripts

## Git workflow

- Branch: `fix/improve-007-ci-typecheck`
- Commit: `ci: add typecheck to CI matrix`

## Steps

### Step 1: Add typecheck to matrix

Add `typecheck` to `matrix.task` list in `.github/workflows/ci.yml`.

**Verify**: YAML valid; job name becomes `typecheck`

### Step 2: Changeset

```bash
bun run changeset-add patch "Add typecheck job to CI pipeline"
```

## Done criteria

- [ ] `typecheck` in ci.yml matrix
- [ ] `bun run typecheck` passes locally
- [ ] Changeset created

## STOP conditions

- None expected.
