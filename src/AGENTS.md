# src/

## OVERVIEW

Domain-oriented runtime modules. Execution: `cli.ts` → `cli/run.ts` → flags/skill/automation/`main()`.

Each subdirectory has its own `AGENTS.md` — read the relevant one before editing.

## STRUCTURE

```text
src/
├── cli.ts, index.ts        # Bin shim + interactive orchestrator
├── api/                    # → api/AGENTS.md
├── auth/                   # → auth/AGENTS.md
├── automation/             # → automation/AGENTS.md
├── cli/                    # → cli/AGENTS.md
├── errors/                 # → errors/AGENTS.md
├── flows/                  # → flows/AGENTS.md
├── permissions/            # → permissions/AGENTS.md
├── policies/               # → policies/AGENTS.md
├── prompts/                # → prompts/AGENTS.md
├── terminal/               # → terminal/AGENTS.md
└── types/                  # → types/AGENTS.md
```

## CROSS-CUTTING

| Concern | Primary module |
| --- | --- |
| Network (`fetch`) | `api/client.ts` only |
| Terminal UI (`@clack`) | `prompts/` only |
| TaggedError types | `errors/` (+ spec errors in `automation/`) |
| Deps injection | `cli/run.ts`, `index.ts`, `flows/interactive-create.ts`, `automation/create.ts` |
| Published subpaths | See root `AGENTS.md` — tsdown entries map 1:1 to several subdirs |

## CONVENTIONS

- All internal imports use `@/*` with `.ts` extensions.
- `index.ts` re-exports `buildPolicies`, CLI flag helpers, and `ParsedCli` — intentional `dist/index.mjs` surface.
- `prompts/index.ts` re-exports auth URLs and terminal helpers for a single orchestrator import.

## ANTI-PATTERNS

- `@clack/prompts` outside `prompts/`
- `fetch` outside `api/client.ts`
- Import `index.ts` from library code (tests and `cli/run.ts` excepted)
- New barrel files aggregating unrelated modules
