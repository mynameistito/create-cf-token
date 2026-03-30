# src/ Reference

## OVERVIEW

Interactive CLI that guides users through Cloudflare API token creation with credential collection, account/permission selection, and automatic restricted-permission retry.

## WHERE TO LOOK

| File | Purpose |
|---|---|
| `index.ts` | Entry point. `main()` orchestrates the full flow. `handleApiError` (never-returning), `buildPolicies`. |
| `api.ts` | Cloudflare REST API wrappers. All return `Result<T, E>` via `Result.tryPromise`. Internal `cfGet` and `cfPost` helpers. |
| `errors.ts` | `TaggedError` subtypes: `CloudflareApiError`, `TokenCreationError`, `RestrictedPermissionError`. |
| `prompts.ts` | All `@clack/prompts` interaction. Internal `check()` guard for cancellation. |
| `permissions.ts` | `groupByService` (PermissionGroup[] → ServiceGroup[]), `extractFailedPerm` (regex extraction from CF errors). |
| `types.ts` | Shared interfaces: `Account`, `PermissionGroup`, `ServiceGroup`, `Policy`, `UserInfo`. |

## CONVENTIONS

- **Error handling**: All API errors flow as `TaggedError` subtypes through `Result`. Pattern-match with `matchError` at call sites. `UnhandledException` from `better-result` wraps unknowns.
- **API layer**: `api.ts` is the only module that calls `fetch`. Every exported function returns `Result<T, CloudflareApiError | UnhandledException>` (or narrower). Credentials passed as `(email, apiKey)` — never stored globally.
- **UI isolation**: All `@clack/prompts` calls live in `prompts.ts`. Other modules never import from `@clack/prompts`.
- **Retry loop**: Token creation retries up to 50 times, auto-excluding `RestrictedPermissionError` permissions. The `excluded` Set tracks what was dropped.
- **Permission scoping**: Permissions are split into user/account/zone buckets by checking `scopes` array for `com.cloudflare.api.user`, `com.cloudflare.api.account`, `com.cloudflare.api.account.zone`.

## ANTI-PATTERNS

- Don't throw raw strings or non-`Error` values — always use `TaggedError` subtypes.
- Don't call `@clack/prompts` outside `prompts.ts`.
- Don't call `fetch` outside `api.ts`.
- Don't unwrap `Result` with `.value` without first checking `.isErr()`.
- Don't import from `index.ts` — it's the CLI entry point, not a module barrel.
