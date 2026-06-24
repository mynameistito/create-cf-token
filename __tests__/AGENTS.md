# **tests**/

## OVERVIEW

Bun test suite (33 files + 3 helpers). Mirrors `src/` layout. No Vitest/Jest.

## STRUCTURE

```text
__tests__/
├── index.test.ts, security.test.ts
├── api/, auth/, automation/, cli/, errors/, flows/
├── permissions/, policies/, prompts/, terminal/
├── e2e/cli.node.e2e.test.ts
└── helpers/
    ├── test-server.ts      # Bun.serve() mock CF API
    ├── spawn-cli.ts        # node dist/cli.mjs spawner
    └── e2e-scenarios.ts    # Shared E2E registrars (~530 LOC)
```

## WHERE TO LOOK

| Pattern               | Location                                            | Notes                                            |
| --------------------- | --------------------------------------------------- | ------------------------------------------------ |
| API unit tests        | `api/client.test.ts`                                | Largest file; `describe.serial` + mock server    |
| CLI args/flags        | `cli/args.test.ts`, `flags.test.ts`, `help.test.ts` | Pure parsing / flag routing                      |
| CLI run orchestration | `cli/run.test.ts`                                   | Deps injection, not `mock.module` on index       |
| Error classes         | `errors/*.test.ts`                                  | `test.concurrent` for pure construction          |
| Interactive flow      | `flows/interactive-create.test.ts`                  | `buildDeps()` injection                          |
| Automation            | `automation/*.test.ts`                              | spec, scope-spec, create, runner, discovery      |
| Prompt UI             | `prompts/*.test.ts`                                 | 8 files; `mock.module("@clack/prompts")`         |
| Node E2E              | `e2e/cli.node.e2e.test.ts`                          | Thin registrar → `e2e-scenarios.ts`              |
| Supply-chain guard    | `security.test.ts`                                  | Forbidden lifecycle scripts, tracked setup paths |

## CONVENTIONS

- Import from `"bun:test"` only.
- Import app code via `@/*`; import shared test helpers via `@tests/*` (e.g. `@tests/helpers/test-server.ts`).
- **Mock server**: `startTestServer(routes)` in `helpers/test-server.ts`; set `CF_API_BASE_URL` in `beforeAll`, delete in `afterAll`.
- **E2E**: `spawn-cli.ts` runs `node dist/cli.mjs` with `stdio: ["ignore", ...]`; `test.skipIf` when `dist/` missing.
- **Deps injection** preferred over `mock.module` for app code; reserve `mock.module` for `@clack/*` and `node:*` shims.
- **Serial tests** when mutating `process.env` or sharing server lifecycle; **concurrent** for pure functions.
- **Result assertions**: `result.isOk()` guard before `.value` — never `.unwrap()`.
- **Fixtures**: inline constants per file; shared E2E fixtures in `e2e-scenarios.ts`.

## CONFIG

| File              | Role                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `bunfig.toml`     | `root = "__tests__"`, coverage → `.coverage/`, excludes `e2e/**` |
| `e2e.bunfig.toml` | `root = "__tests__/e2e"`, coverage off                           |

## ANTI-PATTERNS

- Vitest/Jest imports or config
- E2E against Bun source (Node `dist/cli.mjs` only)
- `mock.module` on `@/index.ts` when deps injection suffices
- Leaving `CF_API_BASE_URL` set after tests

## NOTES

- Default `bun test` excludes `__tests__/e2e/**`; run E2E via `bun run test:e2e:node` (builds first).
- CI: matrix `test`, `test:security`; separate `test:e2e-node-22/24` jobs.
