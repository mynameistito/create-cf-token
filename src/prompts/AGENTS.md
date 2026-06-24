# src/prompts/

## OVERVIEW

All interactive terminal UI. Sole owner of `@clack/prompts` and `@clack/core` imports.

## STRUCTURE

```
prompts/
├── index.ts           # Public re-exports (import from here, not subdirs)
├── types.ts           # GO_BACK symbol, prompt state types
├── guards.ts          # exitIfNonInteractive, check() cancellation guard
├── logging.ts         # spinner, cancelPrompt, logMessage, finishOutro
├── flow/              # High-level prompt sequences
│   ├── credentials.ts # askCredentials
│   ├── preset.ts      # askTokenPreset
│   ├── accounts.ts    # selectAccounts
│   ├── scopes.ts      # selectScopes, buildPermissionsForSelection
│   ├── token-name.ts  # askTokenName
│   └── post-create.ts # askPostCreateAction, showCreatedToken
├── primitives/        # Back-navigable clack wrappers
│   ├── select-with-back.ts
│   ├── text-with-back.ts
│   └── search-multiselect.ts
└── render/            # Pure render fns for custom prompts
    ├── shared.ts, search.ts, select.ts, text.ts
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new prompt step | `flow/` — export via `index.ts` |
| Back-navigation UX | `primitives/*-with-back.ts`, `GO_BACK` in `types.ts` |
| Custom multiselect/search UI | `primitives/search-multiselect.ts` + `render/search.ts` |
| Spinner / outro / cancel | `logging.ts` |
| Non-TTY guard | `guards.ts` `exitIfNonInteractive()` |
| Re-export auth/terminal | `index.ts` (auth URLs, hyperlink, printNote) |

## CONVENTIONS

- Callers import from `#src/prompts/index.ts` only — not from `flow/` or `primitives/` directly.
- `check<T>(value)` throws cancel on clack `Symbol` cancellation.
- `GO_BACK` lets users navigate backward in multi-step flows.
- `render/` functions are pure — no I/O; used by primitives for custom `@clack/core` prompts.
- Permission resolution for UI: `resolveFullAccessPermissions` re-exported from `permissions/resolve.ts`.

## ANTI-PATTERNS

- Import `@clack/prompts` or `@clack/core` outside this tree
- Business logic (API calls, policy building) in prompt functions — keep in `flows/` or `automation/`
- Direct `console.log` for user-facing output (use clack or `terminal/note.ts`)
