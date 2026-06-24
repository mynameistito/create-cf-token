# create-cf-token

**Generated:** 2026-06-24
**Commit:** 84ecd4b
**Branch:** refactor/src-structure

## OVERVIEW

CLI and programmatic library for creating Cloudflare API tokens via interactive prompts or JSON specs. TypeScript/ESM, builds with tsdown (10 entry points), runs on Bun and Node >= 22. Published to npm as `create-cf-token`. Error handling via `better-result` TaggedError; UI via `@clack/prompts`; no Cloudflare SDK.

## STRUCTURE

```
.
├── src/                    # Each subdir has AGENTS.md — start at src/AGENTS.md
│   ├── cli.ts              # npm bin shim → cli/run.ts
│   ├── index.ts            # Interactive orchestrator + re-exports
│   ├── api/                # Cloudflare REST client (raw fetch)
│   ├── auth/               # Dashboard URL helpers
│   ├── automation/         # Non-interactive create, spec, discovery (--skill)
│   ├── cli/                # Args, flags, help, run orchestration
│   ├── errors/             # TaggedError hierarchy (per-file)
│   ├── flows/              # Interactive token-create flow
│   ├── permissions/        # groupByService, resolveFullAccessPermissions
│   ├── policies/           # buildPolicies pure function
│   ├── prompts/            # All @clack/prompts UI (flow/, primitives/, render/)
│   ├── terminal/           # ANSI colour, hyperlinks, notes
│   └── types/              # Shared interfaces
├── __tests__/              # Bun test suite (mirrors src/ layout)
├── assets/automation/      # Agent skill source (shipped in npm package)
├── skill/create-cf-token/  # Published agent skill mirror (sync-skill script)
├── scripts/                # changeset-add.ts, sync-skill.ts
├── .github/workflows/      # ci, security, release, publish-preview, codeql
└── dist/                   # Build output (gitignored)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API call | `src/api/client.ts` | Return `Result<T, E>` via `Result.tryPromise` |
| Add error type | `src/errors/` | Extend base from `bases.ts`; export via `index.ts` |
| Add/modify prompts | `src/prompts/` | Only tree that imports `@clack/prompts` |
| Interactive flow | `src/flows/interactive-create.ts` | `tokenCreateFlow`, retry loop |
| Interactive orchestration | `src/index.ts` | `main()`, `handleApiError`, deps injection |
| CLI entry | `src/cli/run.ts` | flags → skill → automation → main |
| CLI flags/args | `src/cli/args.ts`, `flags.ts` | `parseCliArgs`, non-interactive validation |
| Non-interactive create | `src/automation/create.ts` | Published as `create-cf-token/create` |
| Token spec parsing | `src/automation/spec.ts` | Published as `create-cf-token/spec` |
| Scope spec | `src/automation/scope-spec.ts` | Published as `create-cf-token/scope-spec` |
| Policy construction | `src/policies/build.ts` | Published as `create-cf-token/policies` |
| Permission grouping | `src/permissions/group.ts` | `groupByService`, `extractFailedPerm` |
| Shared types | `src/types/index.ts` | Type-only export |
| Agent skill | `skill/create-cf-token/` | `bun run sync-skill` on publish |
| Build config | `tsdown.config.ts` | 10 entry points, CLI shebang plugin |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `run()` | function | `src/cli/run.ts` | CLI entry: flags → skill → automation → main |
| `main()` | function | `src/index.ts` | Interactive orchestrator |
| `tokenCreateFlow()` | function | `src/flows/interactive-create.ts` | Permission selection + create retry loop |
| `createTokenFromSpec()` | function | `src/automation/create.ts` | Programmatic non-interactive create |
| `parseTokenSpecJson()` | function | `src/automation/spec.ts` | Parse declarative token spec |
| `parseCliArgs()` | function | `src/cli/args.ts` | Argv parsing for automation flags |
| `getUser()` / `getAccounts()` | function | `src/api/client.ts` | Cloudflare GET wrappers |
| `createToken()` / `deleteToken()` | function | `src/api/client.ts` | Token lifecycle |
| `buildPolicies()` | function | `src/policies/build.ts` | Policy objects from selections |
| `groupByService()` | function | `src/permissions/group.ts` | Group perms by service |
| `CloudflareApiError` | class | `src/errors/cloudflare-api-error.ts` | Failed API request |
| `RestrictedPermissionError` | class | `src/errors/restricted-permission-error.ts` | Auto-excluded on retry |

## CONVENTIONS

- **Error handling**: `better-result` TaggedError + `Result<T,E>`. API never throws. `matchError()` at call sites. Check `Result.isErr()` before `.value`.
- **UI isolation**: `@clack/prompts` only under `src/prompts/`. `terminal/` for raw ANSI/hyperlinks. `cli/help.ts` may use `console.log` for --help/--version.
- **Network**: `fetch` only in `src/api/client.ts`. Bearer via `CF_API_TOKEN` env or interactive prompt.
- **Build**: tsdown bundles; shebang injected for `cli` chunk only — not in `src/cli.ts`.
- **Imports**: `#src/*` alias with `.ts` extensions. No barrel re-exports in `src/` (except targeted re-exports in `index.ts`, `prompts/index.ts`, `errors/index.ts`).
- **Deps injection**: `main()`, `run()`, `tokenCreateFlow()` accept optional deps objects for testing.
- **Retry loop**: Token creation retries up to 50 times, auto-excluding `RestrictedPermissionError` permissions.
- **Type-checking**: `tsgo --noEmit`, not `tsc` emit.
- **Linting**: Ultracite via oxfmt/oxlint. Pre-commit: `ultracite fix` + `typecheck` (Lefthook).

## ANTI-PATTERNS (THIS PROJECT)

- Throwing raw strings or non-Error values in catch blocks
- `@clack/prompts` outside `src/prompts/`
- React/`.tsx` dependencies
- `tsc` for compilation
- Barrel re-exports in `src/` (beyond existing index files)
- Shebang in `src/cli.ts`
- `fetch` outside `src/api/`
- `Result.value` without `Result.isErr()` check
- Importing from `index.ts` as a library barrel (except `cli/run.ts` and tests)

## COMMANDS

```bash
bun dev                      # Run CLI from source
bun test                     # Unit tests (__tests__, excludes e2e/)
bun run test:e2e:node        # Build + Node E2E (e2e.bunfig.toml)
bun run test:security        # Supply-chain regression tests
bun run build                # tsdown → dist/
bun run check                # ultracite check
bun run fix                  # ultracite fix
bun run typecheck            # tsgo --noEmit
bun run knip                 # Dead-code scan
bun run sync-skill           # Sync skill/ from assets/automation/
bun run release              # Build + changeset publish --provenance
```

## NOTES

- **Node versions**: CI unit tests on Bun; E2E on Node 22/24; releases on Node 24.
- `CF_API_TOKEN` requires `User Details:Read`, `User API Tokens:Edit`, `Account Settings:Read`.
- `CF_API_BASE_URL` overrides API base (tests use `Bun.serve()` mock).
- `bun.lock` for dev; `package-lock.json` gitignored, generated for `npm:audit` CI.
- Preview packages on PRs via `pkg-pr-new` (`bunx create-cf-token@pr-N`).
- `@types/node` pinned to `~22.19.15`.
- Subpath exports: `.`, `./api`, `./errors`, `./permissions`, `./types`, `./create`, `./spec`, `./scope-spec`, `./policies`.

## CI PIPELINE

Required checks enforced by **Protect main** ruleset.

| Workflow | Trigger | Key Steps |
|----------|---------|-----------|
| `ci.yml` | PR + push to main | `bun:audit`, `npm:audit`, `build`, `check`, `knip`, `deno:dry-run`, `jsr:dry-run`, `test`, `test:security`, `typecheck`; `test:e2e-node-22/24` |
| `security.yml` | PR + push + schedule | `osv-scanner`, `gitleaks`, `zizmor`, `dependency-review`, `actionlint` |
| `release.yml` | Push to main | Changesets version + npm publish with provenance |
| `publish-preview.yml` | PR (non-forks) | `pkg-pr-new` preview |
| `codeql.yml` | Weekly | JS/TS security analysis |
