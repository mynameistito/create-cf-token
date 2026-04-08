# __tests__/ Reference

## OVERVIEW

Bun test suite. 10 test files + 1 shared helper. Uses `bun:test` exclusively — no Vitest/Jest. E2E tests spawn CLI as subprocess; unit tests use `Bun.serve()` mock HTTP server.

## WHERE TO LOOK

| File | Purpose |
|---|---|
| `api.test.ts` | Unit tests for all `api.ts` functions. Uses `Bun.serve()` mock server on random port. 13 test cases, most in `api.test.ts`. |
| `permissions.test.ts` | Unit tests for `groupByService` and `extractFailedPerm`. |
| `errors.test.ts` | Unit tests for `TaggedError` subclass construction. Uses `test.concurrent`. |
| `build-policies.test.ts` | Unit tests for `buildPolicies` pure function. Uses `test.concurrent`. |
| `handle-cli-error.test.ts` | Unit tests for `handleCliError` using `spyOn` mocking. |
| `cli.run.test.ts` | Module-level mock test using `mock.module()` (Bun-specific). Imports `#src/cli.ts` with mocked `#src/index.ts`. |
| `cli.flags.test.ts` | Subprocess-based flag tests (`--help`, `--version`). Spawns `bun` or `node` child process. |
| `cli.e2e.test.ts` | Full E2E with mock server. Spawns CLI subprocess with closed stdin so `@clack/prompts` cancels immediately. |
| `cli.node.e2e.test.ts` | Node-specific E2E. Runs `dist/cli.mjs` via `node:child_process`. Skipped if `dist/` not built (`test.skipIf`). |
| `import-all-coverage.test.ts` | Smoke test. Uses `Bun.Glob` to dynamically import all `.ts` files in `src/` for coverage. |
| `helpers/test-server.ts` | Shared `Bun.serve()` factory. `successResponse()` and `errorResponse()` helpers wrap fixtures in CF API envelope. |

## CONVENTIONS

- **Test runner**: `bun:test` only. No Vitest, Jest, or other frameworks. Import `{ describe, expect, test, ... }` from `"bun:test"`.
- **Mock server pattern**: Tests spin up `Bun.serve()` on `port: 0` (random port). Set `process.env.CF_API_BASE_URL` to test server URL. Always `delete process.env.CF_API_BASE_URL` in `afterAll()` (with `biome-ignore lint/performance/noDelete`).
- **Subprocess E2E**: CLI tests spawn `Bun.spawn(["bun", CLI_ENTRY, ...args])` or `node:child_process.spawn("node", [DIST_CLI, ...args])`. Stdin set to `"ignore"` so `@clack/prompts` cancels.
- **Module mocking**: `cli.run.test.ts` uses `mock.module()` (Bun API) to replace `#src/index.ts` at import time.
- **Import style**: All test imports use `#src/*` package.json imports alias with `.ts` extensions (same as production code).
- **Fixture style**: Test data defined as inline constants (`USER_FIXTURE`, `ACCOUNTS_FIXTURE`, etc.) at top of each file. No external fixture files.
- **Result assertions**: Uses `better-result` `Result` type with `result.isOk()` / `result.isErr()` guard pattern, not `.unwrap()`.
- **Node E2E exclusion**: `cli.node.e2e.test.ts` is excluded from default `bun test` via `bunfig.toml` (`exclude = ["**/*.node.test.ts"]`). Runs via `bun run test:node` which builds first.
+ **Node E2E exclusion**: `cli.node.e2e.test.ts` is excluded from default `bun test` via `bunfig.toml` (`exclude = ["**/*.node.e2e.test.ts"]`). Runs via `bun run test:node` which builds first.
- **Lint suppressions**: `biome-ignore` comments are always annotated with a reason.

## NOTES

- `prompts.ts` has no direct unit test coverage. Only exercised indirectly through E2E subprocess tests.
- CI does not run `bun test`. Tests are local-only.
- `bunfig.toml` enables coverage by default (`coverage = true`), outputs to `.coverage/`.