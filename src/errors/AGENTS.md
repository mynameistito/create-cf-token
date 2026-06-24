# src/errors/

## OVERVIEW

`better-result` TaggedError hierarchy. Published via `create-cf-token/errors` (4 API-facing types).

## STRUCTURE

```text
errors/
├── bases.ts                        # TaggedErrorClass bases (internal)
├── index.ts                        # Public re-exports (tsdown entry)
├── cloudflare-api-error.ts         # HTTP / envelope failures
├── token-creation-error.ts         # POST /user/tokens non-restricted failure
├── token-deletion-error.ts         # DELETE /user/tokens/:id failure
├── restricted-permission-error.ts    # Restricted perm — auto-excluded on retry
├── token-creation-flow-error.ts      # Interactive flow failure (not in index.ts)
└── token-deletion-flow-error.ts      # Interactive delete failure (not in index.ts)
```

Automation-only bases (`ScopeSpecError`, `TokenSpecError`, `CreateFlowError`) live in `bases.ts`; classes defined in `automation/spec.ts`, `automation/scope-spec.ts`, and `automation/create.ts`.

## WHERE TO LOOK

| Task                    | Location                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| Add published error     | New file extending base from `bases.ts`; export in `index.ts`               |
| Add internal/flow error | Extend base in `bases.ts`; export from owning module                        |
| API error mapping       | `api/client.ts` constructs `CloudflareApiError`, `TokenCreationError`, etc. |

## CONVENTIONS

- Pattern: `bases.ts` defines `*Base` TaggedErrorClass; thin `export class X extends XBase {}` per file.
- `index.ts` exports only the four API/token errors — not flow or spec errors.
- API/flow call sites use `matchError()` and return `Result.err()`; automation spec errors (`CreateFlowError`, `ScopeSpecError`, `TokenSpecError`) are thrown and caught in `automation/runner.ts`.

## ANTI-PATTERNS

- Throwing raw strings instead of TaggedError subtypes
- Exporting all errors from `index.ts` (keep published surface minimal)
- Defining error classes inline in `api/` or `flows/` without a base in `bases.ts`
