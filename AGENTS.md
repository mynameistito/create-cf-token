# create-cf-token

**Generated:** 2026-04-09
**Commit:** 5e104ed
**Branch:** main

## OVERVIEW

CLI tool for creating Cloudflare API tokens via interactive guided prompts. TypeScript/ESM, builds with tsdown, runs on Bun and Node >= 22. Published to npm as `create-cf-token`. Error handling via `better-result` TaggedError; UI via `@clack/prompts`; no Cloudflare SDK.

## STRUCTURE

```
.
├── src/              # All source code (8 files)
│   ├── cli.ts        # Thin bin entry, imports main() from index.ts
│   ├── index.ts      # CLI orchestrator + retry logic (~550 lines)
│   ├── api.ts        # Cloudflare REST API wrappers (raw fetch)
│   ├── errors.ts     # TaggedError hierarchy (better-result)
│   ├── permissions.ts # groupByService, extractFailedPerm
│   ├── prompts.ts    # @clack/prompts interactive UI
│   ├── types.ts      # Shared interfaces
│   └── colour.ts     # ANSI color constants (British spelling intentional)
├── __tests__/        # Bun test suite (10 test files + helper)
├── assets/           # Prompt template + social preview (not src)
├── .changeset/       # Pending version bumps
├── .claude/          # Claude Code hooks + skills
├── .github/workflows/ # ci.yml, release.yml, publish-preview.yml, codeql.yml
├── dist/             # Build output (gitignored, published to npm)
└── opensrc/          # Downloaded dependency source (gitignored)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new API call | `src/api.ts` | Must return `Result<T, E>` via `Result.tryPromise` |
| Add a new error type | `src/errors.ts` | Use `TaggedError` from `better-result` |
| Add/modify CLI prompts | `src/prompts.ts` | Only module that imports `@clack/prompts` |
| Change token creation flow | `src/index.ts` | `main()` orchestrates everything |
| Add shared types | `src/types.ts` | API response types, input types |
| Permission grouping logic | `src/permissions.ts` | `groupByService()`, `extractFailedPerm()` |
| Add CLI flags/args | `src/index.ts` | `handleFlags()` parses --help, --version |
| Change build config | `tsdown.config.ts` | 6 entry points, shebang banner, version define |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `main()` | function | `src/index.ts` | CLI orchestrator |
| `handleFlags()` | function | `src/index.ts` | --help/--version parser, uses console.log directly |
| `handleApiError()` | function | `src/index.ts` | Never-returning error handler |
| `buildPolicies()` | function | `src/index.ts` | Constructs API policy objects from selections |
| `run()` | function | `src/cli.ts` | Entry guard with `import.meta.main` check |
| `cfGet()` | function | `src/api.ts` | Internal GET helper (not exported) |
| `getUser()` | function | `src/api.ts` | GET /user |
| `getAccounts()` | function | `src/api.ts` | GET /accounts |
| `getPermissionGroups()` | function | `src/api.ts` | GET /user/tokens/permission_groups |
| `createToken()` | function | `src/api.ts` | POST /user/tokens |
| `CloudflareApiError` | class | `src/errors.ts` | Base TaggedError |
| `TokenCreationError` | class | `src/errors.ts` | Token create failed |
| `RestrictedPermissionError` | class | `src/errors.ts` | Restricted permission exclusion |
| `TokenDeletionError` | class | `src/errors.ts` | Token delete failed |
| `groupByService()` | function | `src/permissions.ts` | Groups perms by service |
| `extractFailedPerm()` | function | `src/permissions.ts` | Error message helper |

## CONVENTIONS

- **Error handling**: `better-result` TaggedError everywhere. API functions return `Result<T, E>`, never throw. `handleApiError` in index.ts is `never`-returning. Pattern-match with `matchError()` at call sites.
- **UI isolation**: Only `prompts.ts` imports `@clack/prompts`. Other modules never touch the terminal. `colour.ts` provides raw ANSI codes, not clack abstractions. `handleFlags()` uses `console.log` directly for --help/--version (acceptable exception).
- **No SDK**: Cloudflare API called via raw `fetch`. No `@cloudflare/workers-types` or CF SDK.
- **Build**: `tsdown` (Rolldown-based). TypeScript is type-check only (`noEmit: true`). No tsc in build pipeline. Shebang injected via `banner` function (keyed on `chunk.fileName.startsWith("cli")`). Do **not** add shebang to `src/cli.ts`.
- **Module resolution**: `module: "Preserve"`, `moduleResolution: "bundler"`. `.ts` extension imports allowed. All internal imports use `#src/*` package.json imports alias.
- **Type-checking**: `tsgo --noEmit` (TypeScript 7 native Go rewrite), not `tsc`.
- **Linting**: Ultracite (Biome preset) via `bun x ultracite fix`/`check`. Pre-commit hook auto-fixes + stages via Lefthook. Claude Code post-edit hook skips `noUnusedImports`.
- **Process env**: `CF_EMAIL` pre-fills email prompt. `CF_API_TOKEN` used for API auth (not committed). `CF_API_BASE_URL` overridable for testing.
- **Version**: `process.env.npm_package_version` replaced at build time via tsdown `define`. Fallback `"0.0.0"` is dead code in published builds.
- **Test runner**: Bun test (`bun:test`). No Vitest/Jest. E2E tests use subprocess spawning, unit tests use `Bun.serve()` mock HTTP server.

## ANTI-PATTERNS (THIS PROJECT)

- Throwing raw strings or non-Error values in catch blocks
- Calling `@clack/prompts` from outside `prompts.ts`
- Adding `.tsx` or React dependencies (pure CLI, no JSX)
- Using `tsc` for compilation (tsdown handles bundling)
- Adding barrel index re-exports in `src/`
- Adding a shebang to `src/cli.ts` (injected by build tool)
- Calling `fetch` outside `api.ts`
- Accessing `Result.value` without checking `Result.isErr()` first
- Importing from `index.ts` as if it were a module barrel (tests excepted)

## COMMANDS

```bash
bun dev                    # Run CLI from source
bun test                   # Run test suite
bun run test:node          # Build + run Node-specific E2E test
bun run build              # Build to dist/ via tsdown
bun x ultracite check      # Lint + format check
bun x ultracite fix        # Auto-fix lint + format
bun run typecheck           # Type-check via tsgo --noEmit
bun run changeset           # Create version changeset
bun run release             # Build + publish to npm
```

## NOTES

- **No tests in CI**. CI runs typecheck, lint, build, audit — but not `bun test`. Tests are local-only.
- **Node version mismatch**: CI tests on Node 22, releases on Node 24.
- `CF_EMAIL` env var pre-fills the email prompt.
- `process.env.CF_API_TOKEN` is runtime auth (not committed).
- `process.env.CF_API_BASE_URL` overrides API base URL (used by tests).
- Pre-commit hook auto-fixes + stages formatting via Lefthook.
- Preview packages published on every PR via `pkg-pr-new` (`bunx create-cf-token@pr-N`).
- `@types/node` pinned to `~22.19.15` (Dependabot blocked from >= 23.0.0).
- `package-lock.json` is gitignored; generated on-the-fly for npm audit in CI.
- Dual lock files: `bun.lock` for dev, `package-lock.json` generated for audit only.
- 6 entry points in tsdown: `cli`, `index`, `api`, `errors`, `permissions`, `types`.
- `types` sub-export is type-only (no runtime condition in `exports`).

## CI PIPELINE

| Workflow | Trigger | Key Steps |
|----------|---------|-----------|
| `ci.yml` | PR + push to main | typecheck, lint, build, bun audit, npm audit |
| `release.yml` | Push to main | changeset version, publish with provenance |
| `publish-preview.yml` | PR (not forks) | `pkg-pr-new` preview publish |
| `codeql.yml` | Weekly (Mon 07:23 UTC) | Security scanning (extended queries) |