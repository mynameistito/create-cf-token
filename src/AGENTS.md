# src/ Reference

## OVERVIEW

CLI runtime modules. `main()` in `index.ts` orchestrates the full token-creation flow from credential collection through API calls to interactive permission selection and token output.

## WHERE TO LOOK

| File | Purpose |
|---|---|
| `index.ts` | Entry point. `main()` orchestrates the full flow. `handleApiError` (never-returning), `handleFlags`, `handleCliError`, `buildPolicies`. |
| `api.ts` | Cloudflare REST API wrappers. All return `Result<T, E>` via `Result.tryPromise`. Internal `cfGet` helper. Credentials passed as `(email, apiKey)` — never stored globally. |
| `errors.ts` | `TaggedError` subtypes: `CloudflareApiError`, `TokenCreationError`, `RestrictedPermissionError`, `TokenDeletionError`. |
| `prompts.ts` | All `@clack/prompts` interaction. Internal `check()` guard for cancellation. 34884 bytes — largest file, contains all interactive logic. |
| `permissions.ts` | `groupByService` (PermissionGroup[] → ServiceGroup[]), `extractFailedPerm` (regex extraction from CF errors). |
| `types.ts` | Shared interfaces: `Account`, `PermissionGroup`, `ServiceGroup`, `Policy`, `UserInfo`. |
| `colour.ts` | ANSI color constants object (British spelling intentional). Default export of 5 color codes. |
| `cli.ts` | Thin bin entry (26 lines). Imports `main`, `handleFlags`, `handleCliError` from `#src/index.ts`. Guards execution with `import.meta.main`. No shebang — injected at build time by tsdown. |

## CONVENTIONS

- **Error handling**: All API errors flow as `TaggedError` subtypes through `Result`. Pattern-match with `matchError` at call sites. `UnhandledException` from `better-result` wraps unknowns.
- **API layer**: `api.ts` is the only module that calls `fetch`. Every exported function returns `Result<T, CloudflareApiError | UnhandledException>` (or narrower). Credentials passed as `(email, apiKey)` — never stored globally.
- **UI isolation**: All `@clack/prompts` calls live in `prompts.ts`. Other modules never import from `@clack/prompts`. `colour.ts` provides raw ANSI codes, not clack abstractions.
- **Retry loop**: Token creation retries up to 50 times, auto-excluding `RestrictedPermissionError` permissions. The `excluded` Set tracks what was dropped.
- **Permission scoping**: Permissions are split into user/account/zone buckets by checking `scopes` array for `com.cloudflare.api.user`, `com.cloudflare.api.account`, `com.cloudflare.api.account.zone`.
- **Import style**: All internal imports use `#src/*` package.json imports alias with `.ts` extensions. No relative `../` paths.
- **Version**: `process.env.npm_package_version` is replaced at build time by tsdown `define`. The `"0.0.0"` fallback is dead code in published builds.

## ANTI-PATTERNS

- Use `TaggedError` subtypes instead of throwing raw strings or non-`Error` values.
- Call `@clack/prompts` only from `prompts.ts`.
- Keep all `fetch` calls in `api.ts` — no other module should hit the network directly.
- Always check `Result.isErr()` before accessing `.value`.
- Never import from `index.ts` — it's the CLI entry point, not a module barrel (tests excepted).
- Never add a shebang to `cli.ts` — it's injected at build time by tsdown.