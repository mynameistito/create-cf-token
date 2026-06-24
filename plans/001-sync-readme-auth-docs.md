# Plan 001: Sync README auth docs to Bearer token flow

> **Executor instructions**: Follow step by step. Run every verification command. On STOP conditions, stop and report.
>
> **Drift check**: `git diff --stat fc3a338..HEAD -- README.md SECURITY.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `fc3a338`, 2026-06-24

## Why this matters

README still documents Global API Key + email auth removed in v1.1.0. New users follow wrong prerequisites.

## Current state

- `README.md` lines 20-25, 50 reference Global API Key, `CF_EMAIL`, email prompt.
- `CHANGELOG.md:49` documents switch to scoped Bearer token via `CF_API_TOKEN`.
- `src/prompts.ts:995-1009` — `askCredentials()` only collects API token (password prompt or `CF_API_TOKEN`).
- `src/index.ts:70` — help text documents `CF_API_TOKEN` only.

## Commands

| Purpose   | Command             | Expected |
| --------- | ------------------- | -------- |
| Lint      | `bun run check`     | exit 0   |
| Typecheck | `bun run typecheck` | exit 0   |

## Scope

**In scope**: `README.md`, `SECURITY.md` (credential bullet mentions Global API Key)

**Out of scope**: `CONTRIBUTING.md` (plan 005), `AGENTS.md`, code changes

## Git workflow

- Branch: `fix/improve-001-readme-auth`
- Commit: `docs: sync README and SECURITY to Bearer token auth`

## Steps

### Step 1: Update README prerequisites and flow

Replace Global API Key/email references with scoped API token requirements matching `src/index.ts` welcome note:

- Node.js 22+
- Scoped Cloudflare API token with User Details:Read, User API Tokens:Edit, Account Settings:Read
- Optional `CF_API_TOKEN` env var (not Global API Key)
- Remove all `CF_EMAIL` references
- Update Flow step 1 to "Authenticate with your scoped Cloudflare API token"
- Keep retry/revoke feature bullets as-is (plan 002 restores them)

**Verify**: `rg "Global API Key|CF_EMAIL" README.md` → no matches

### Step 2: Update SECURITY.md credential scope bullet

Change "Global API Keys, account emails" to "scoped API tokens" and created tokens.

**Verify**: `rg "Global API Key" SECURITY.md` → no matches

### Step 3: Add changeset

```bash
bun run changeset-add patch "Sync README and SECURITY docs to scoped Bearer token authentication"
```

**Verify**: new file in `.changeset/`

## Done criteria

- [ ] No Global API Key / CF_EMAIL in README.md or SECURITY.md
- [ ] `bun run check` exit 0
- [ ] Changeset created

## STOP conditions

- README already updated (drift) — report and skip duplicate edits.
