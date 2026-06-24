# src/flows/

## OVERVIEW

Interactive token creation, deletion, and the 50-attempt restricted-permission retry loop.

## STRUCTURE

```
flows/
└── interactive-create.ts    # tokenCreateFlow, deleteTokens, flow error exports
```

## WHERE TO LOOK

| Symbol                               | Role                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `tokenCreateFlow(deps?)`             | Full interactive create: preset → accounts → scopes → name → create with retry |
| `deleteTokens(ids, apiToken, deps?)` | Batch delete with `TokenDeletionFlowError` on failure                          |
| `TokenCreationFlowError`             | User-facing create flow failure                                                |
| `TokenDeletionFlowError`             | User-facing delete flow failure                                                |

## CONVENTIONS

- Retry loop (max 50): on `RestrictedPermissionError`, add perm name to `excluded` set and retry via `buildPolicies`.
- `GO_BACK` from prompts restarts inner steps without exiting the flow.
- `deps` injection mirrors `main()` pattern — all prompt and API calls overridable in tests.
- Uses `buildPolicies` from `policies/build.ts` before each `createToken` attempt.

## ANTI-PATTERNS

- Non-interactive / spec-based create here — use `automation/create.ts`
- Direct `@clack/prompts` imports — use `@/prompts/index.ts`
- Throwing on API errors — propagate `Result` or map to flow errors
