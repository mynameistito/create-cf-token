# create-cf-token

## 1.2.0

### Minor Changes

- f76b3c6: Add a one-click full-access preset (all accounts, all scopes, read + write), Select All shortcuts in multiselect prompts, a bulk access-level prompt when every scope is selected manually, and exclude API token management permissions that sub-tokens cannot grant (fixes #127)
- f76b3c6: Restructure the entire `src/` tree from flat monolith files into domain-oriented modules with clear boundaries, deps injection, and `@/` path aliases.

  **Consumer impact:** None for npm or programmatic API users. All `package.json` and `dist/` subpath exports (`create-cf-token`, `create-cf-token/api`, `create-cf-token/create`, etc.) are unchanged. CLI flags, token-creation behaviour, and retry semantics are preserved. This release is contributor- and maintainer-facing.

  **Removed re-export shims** — all imports resolve to real module paths; no compatibility forwarding files.

  ### `src/prompts/` decomposition

  The monolithic `prompts.ts` is split into layers:

  - **`index.ts`** — public re-exports (callers import here, not subdirs)
  - **`types.ts`** — `GO_BACK`, prompt state types
  - **`guards.ts`** — `check()`, `exitIfNonInteractive()`
  - **`logging.ts`** — spinner, cancel, log, outro
  - **`flow/`** — high-level sequences (`credentials`, `preset`, `accounts`, `scopes`, `token-name`, `post-create`)
  - **`primitives/`** — back-navigable clack wrappers (`select-with-back`, `text-with-back`, `search-multiselect`)
  - **`render/`** — pure render functions for custom `@clack/core` prompts

  `@clack/prompts` and `@clack/core` are confined to `src/prompts/` only.

  ### `src/errors/` decomposition
  - **`bases.ts`** — internal `TaggedErrorClass` factories (incl. automation-only bases)
  - **`index.ts`** — published surface: `CloudflareApiError`, `TokenCreationError`, `TokenDeletionError`, `RestrictedPermissionError`
  - **Per-file classes** — thin `extends *Base` exports for API, flow, and automation errors
  - Flow errors (`TokenCreationFlowError`, `TokenDeletionFlowError`) live in `errors/` but are not re-exported from `index.ts`

  ### CLI architecture

  `index.ts` no longer owns flag parsing, help, or automation routing:

  1. **`cli.ts`** — npm bin shim delegating to `cli/run.ts`
  2. **`cli/run.ts`** — deps-injectable `run()`: `handleFlags` → `handleSkillFlag` → `runAutomationIfNeeded` → `main()`
  3. **`cli/args.ts`** — `parseCliArgs`, `CliArgs`, non-interactive spec validation
  4. **`cli/flags.ts`** — early-exit handlers; re-exported from `index.ts` for programmatic use
  5. **`cli/help.ts`** — `--help`, `--version`, automation help, skill output

  ### Cross-cutting conventions (enforced by layout)
  - **Network** — `fetch` only in `api/client.ts`
  - **Terminal UI** — `@clack/*` only under `prompts/`; raw ANSI in `terminal/`
  - **Deps injection** — `cli/run.ts`, `index.ts`, `flows/interactive-create.ts`, `automation/create.ts` accept optional deps for testing
  - **Barrel policy** — no catch-all re-exports; only `index.ts`, `prompts/index.ts`, and `errors/index.ts` aggregate exports

  ### Import aliases (`#src/*` → `@/*`)
  - **`tsconfig.json`** — `paths`: `@/*` → `./src/*`, `@tests/*` → `./__tests__/*` (no `baseUrl`; TS 6 compatible)
  - **`package.json` `imports`** — `"@/*": "./src/*"`, `"@tests/*": "./__tests__/*"`
  - **`deno.json` `imports`** — `"@/"` → `"./src/"`, `"@tests/"` → `"./__tests__/"`
  - All `src/` modules use `@/…` imports with `.ts` extensions; no relative `./` or `../` cross-module imports remain

  ### Build & publish config
  - **`tsdown.config.ts`** — entry points updated to new module paths (same 10 published chunks; `dist/` output filenames unchanged)
  - **`deno.json` `exports`** — source paths aligned with tsdown entries (`./src/api/client.ts`, `./src/automation/create.ts`, etc.)

  ### Agent knowledge base

  Hierarchical `AGENTS.md` added/updated across the repo:

  - Root `AGENTS.md` — project map, code symbols, CI, conventions
  - Per-subdirectory `AGENTS.md` under every `src/*` domain (`api`, `auth`, `automation`, `cli`, `errors`, `flows`, `permissions`, `policies`, `prompts`, `terminal`, `types`)
  - `CLAUDE.md` pointers in each directory for AI tooling

  ### Contributor migration

  | Old import            | New import                                                        |
  | --------------------- | ----------------------------------------------------------------- |
  | `#src/api.ts`         | `@/api/client.ts`                                                 |
  | `#src/automation.ts`  | `@/automation/runner.ts`                                          |
  | `#src/cli-args.ts`    | `@/cli/args.ts`                                                   |
  | `#src/errors.ts`      | `@/errors/index.ts`                                               |
  | `#src/permissions.ts` | `@/permissions/group.ts`                                          |
  | `#src/policies.ts`    | `@/policies/build.ts`                                             |
  | `#src/prompts.ts`     | `@/prompts/index.ts` (or specific `flow/` / `primitives/` export) |
  | `#src/colour.ts`      | `@/terminal/colour.ts`                                            |
  | `#src/types.ts`       | `@/types/index.ts`                                                |

  Interactive token creation logic moved from `index.ts` to `@/flows/interactive-create.ts`. CLI orchestration moved to `@/cli/run.ts`.

- f76b3c6: Fix CLI runtime stability and update the project linting setup for the current Ultracite Oxlint/Oxfmt toolchain.

  This release fixes Cloudflare API error construction with the installed `better-result` version, prevents non-interactive CLI runs from hanging when prompts cannot read from a TTY, and restores the generated CLI shebang in the built `dist/cli.mjs` output.

  It also updates tests and source formatting to satisfy the current Ultracite ruleset, including Unicode-aware regular expressions, sorted object keys, async subprocess handling, and deterministic E2E behavior for Bun and Node subprocess tests.

- f76b3c6: Restore restricted-permission retry and session token revoke flows
- f76b3c6: Add non-interactive token creation, scope discovery, agent skill, and programmatic API exports.

  ### Discovery (read-only)
  - `--list-scopes`, `--list-permissions`, and `--list-accounts` with `--format json|table` (JSON default on non-TTY)
  - No token created; requires `CF_API_TOKEN` only

  ### Non-interactive create
  - `-n` / `--non-interactive` and `CREATE_CF_TOKEN_NON_INTERACTIVE=1`
  - `--name`, `--preset full-access`, `--accounts`, `--scopes`, `--output json`, `--dry-run`
  - Declarative scope specs: service:level, permission key:level, or exact permission names
  - `create --file token-spec.json` and `create --file -` for stdin JSON specs
  - Incomplete specs on non-TTY fail fast with actionable errors (no hang)
  - Token secret emitted to stdout with `--output json`; progress to stderr

  ### Agent skill & help
  - `--skill` prints the full agent playbook (overview + all reference sections); no auth or TTY required
  - `--help skill` is an alias for `--skill`
  - `--help automation` documents non-interactive flags and examples
  - Default `--help` mentions both automation and skill entry points
  - Single source in `assets/automation/`; repo mirror at `skill/create-cf-token/` via `bun run sync-skill`
  - `assets/automation/` and `assets/token-spec.schema.json` ship in the npm package

  ### Programmatic exports
  - `create-cf-token/create` — `createTokenFromSpec()`
  - `create-cf-token/spec` — token spec parsing
  - `create-cf-token/scope-spec` — scope spec resolution
  - `create-cf-token/policies` — `buildPolicies()` (moved from index)

  ### Tests
  - E2E coverage for `--skill`, discovery, dry-run, JSON create, and non-TTY fail-fast behavior

  Closes #131.

### Patch Changes

- 02356e2: Abort token creation retries when a restricted permission is already excluded, preventing up to 50 identical API calls and surfacing a clear error instead.
- f76b3c6: Remove redundant exit delete prompt after keeping a token; clarify post-create action labels (fixes #129)
- 9890390: trying to fix release
- f76b3c6: Remove unused showNote export from prompts module
- f76b3c6: Add knip configuration so CI knip job passes
- f76b3c6: Sync README and SECURITY docs to scoped Bearer token authentication
- f76b3c6: Sync AGENTS.md and CONTRIBUTING to current codebase
- f76b3c6: Add JSR publishing configuration and refactor public API types for fast-check compliance.

  This changeset prepares the package for JSR (`deno publish`) without changing the npm release artifact or CLI behaviour for existing consumers.

  ### JSR / Deno tooling
  - Add `deno.json` for `@mynameistito/create-cf-token` with exports mirroring `package.json` subpaths, `#src/` and runtime `npm:` import mappings, and `publish.include` aligned with the npm `files` field (source, automation assets, README, LICENSE)
  - Add `deno task publish:dry-run` and `deno task pack:dry-run` (no `--allow-slow-types` or `--allow-dirty`; requires a clean git tree like a real publish)
  - Run `bun run dryrun:deno` in CI to validate JSR fast types and publish metadata on every PR (required check on `main`)

  ### JSR fast types (public API)
  - Introduce `src/tagged-error-bases.ts` with explicit `TaggedErrorClass` annotations for all `better-result` error factories
  - Refactor exported error classes in `errors.ts`, `create.ts`, `scope-spec.ts`, and `spec.ts` to extend those bases instead of inline `createTaggedError()` calls (fixes slow-type diagnostics that block JSR documentation and Node `.d.ts` generation)
  - Replace help-text colour destructuring with `colour.*` property access (JSR disallows destructuring in the public module graph)
  - Guard `import.meta.dirname` in `automation-paths.ts` for Deno's stricter module metadata typing

- f76b3c6: Add comprehensive TSDoc across the public API and internal modules so IDE tooltips, generated docs, and JSR type documentation accurately describe behaviour.

  **Consumer impact:** None for runtime behaviour, CLI flags, or published type shapes. This release improves developer experience for programmatic consumers (`create-cf-token`, subpath imports) and contributors working in `src/`.

  ### Published library surface
  - **`index.ts`** — `@module` overview for the interactive orchestrator; documents `main()`, credential verification, session loop, and intentional re-exports (`buildPolicies`, CLI flag helpers)
  - **`api/client.ts`** — `@module api/client`; documents all Cloudflare REST wrappers (`getUser`, `getAccounts`, `getPermissionGroups`, `createToken`, `deleteToken`), internal helpers, pagination, and `Result` error mapping
  - **`automation/create.ts`** — `@module automation/create`; documents `createTokenFromSpec`, deps injection, error unions, and retry/exclusion semantics
  - **`automation/spec.ts`** — token spec parsing, normalization, and `TokenSpecError` conditions
  - **`automation/scope-spec.ts`** — scope/preset permission resolution and `ScopeSpecError` cases
  - **`policies/build.ts`** — `buildPolicies` inputs, account/resource scoping, and policy object shape
  - **`permissions/group.ts`** / **`permissions/resolve.ts`** — `groupByService`, `extractFailedPerm`, `resolveFullAccessPermissions`, and token-management exclusions
  - **`types/index.ts`** — documents shared interfaces (`Account`, `PermissionGroup`, `TokenPolicy`, `CreatedToken`, etc.)
  - **`errors/`** — module docs on `bases.ts` (full TaggedError hierarchy), class-level docs on all published error types, and `@link` cross-references between bases and thin exports

  ### CLI & automation routing
  - **`cli/args.ts`** — `parseCliArgs`, `CliArgs`, non-interactive spec validation, and discovery command shapes
  - **`cli/flags.ts`** — `@module cli/flags`; `parseArgv`, `handleFlags`, `handleSkillFlag`, `runAutomationIfNeeded` with `@param` / `@returns` and early-exit semantics
  - **`cli/help.ts`** — help, version, automation help, and skill output entry points
  - **`cli/run.ts`** — deps-injectable `run()` orchestration (flags → skill → automation → `main()`)
  - **`automation/runner.ts`** — `shouldRunAutomation`, `runAutomationCreate`, `runDiscovery`, and non-interactive failure paths
  - **`automation/discovery.ts`** — `--discover` formatters for scopes, permissions, and accounts
  - **`automation/paths.ts`** — agent skill file paths and `readAutomationFile`
  - **`auth/template-url.ts`** — dashboard URL helpers for the interactive auth template flow

  ### Interactive flow & prompts
  - **`flows/interactive-create.ts`** — `tokenCreateFlow`, `deleteTokens`, retry loop, and flow error types
  - **`prompts/types.ts`** — `GO_BACK`, prompt state, and search option types
  - **`prompts/guards.ts`** — `check()` cancellation guard and `exitIfNonInteractive()`
  - **`prompts/logging.ts`** — spinner, cancel, log, and outro helpers
  - **`prompts/flow/`** — documents each step (`credentials`, `preset`, `accounts`, `scopes`, `token-name`, `post-create`)
  - **`prompts/primitives/search-multiselect.ts`** — refactored inline types with TSDoc; documents back-navigation and `@clack/core` integration

  ### Terminal helpers
  - **`terminal/colour.ts`**, **`terminal/hyperlink.ts`**, **`terminal/note.ts`** — ANSI colour tokens, OSC-8 hyperlinks, and boxed notes

  ### Documentation conventions applied
  - `@module` tags on primary entry files for clear module boundaries in IDE outline views
  - Consistent `@param`, `@returns`, and `@throws` (where applicable) on exported functions
  - `{@linkcode …}` / `{@link …}` for cross-references between errors, bases, and public APIs
  - Internal interfaces and union error types documented alongside their owning exports
  - No logic, import graph, or export surface changes — comments only across **39 files** (~500 lines of documentation)

- f76b3c6: Add typecheck job to CI pipeline
- f76b3c6: Paginate Cloudflare account listing beyond the first 50 accounts
- f76b3c6: Harden Cloudflare API error response parsing for malformed bodies
- f76b3c6: Stop exporting `HELP_TEXT` and `AUTOMATION_HELP_TEXT` from the package entry point.

  These string constants were re-exported from `create-cf-token` for convenience, but JSR's slow-type checks reject them when they are part of the public API surface. The help strings are now module-private in `help.ts`; the CLI behaviour is unchanged.

  **Migration:** if you imported these constants for display, run `create-cf-token --help` or `create-cf-token --help automation` instead. They were not part of the documented programmatic API.

- f76b3c6: Add automated JSR publishing, keep `deno.json` in sync with `package.json`, and align source with Deno’s stricter publish typechecker.

  **Consumer impact:** None for npm installs, CLI behaviour, or programmatic API shapes. JSR consumers (`jsr:@mynameistito/create-cf-token`) gain automated releases on version bumps. Requires one-time linking of the JSR package to this GitHub repo in package settings.

  ### Release workflow (`release.yml`)
  - Publish to JSR via `bunx jsr publish` in the **publish** job, using GitHub Actions OIDC (`id-token: write` — no `JSR_TOKEN` secret)
  - `deno.json` sync runs only in the **version** job via `version-packages` (not duplicated at publish time)

  ### `scripts/sync-deno.ts` + `version-packages`
  - New `bun run sync-deno` copies `package.json` → `deno.json`:
    - **`version`** — semver aligned on every changeset version bump
    - **`imports`** — runtime `dependencies` rewritten as `npm:` specifiers (e.g. `@clack/core` → `npm:@clack/core@^1.4.2`); path aliases (`@/`, `@tests/`) preserved
  - Hooked into `version-packages` so version PRs commit both manifests together

  ### `deno.json` tooling
  - Add `$schema`, `nodeModulesDir: "manual"`, and stricter `compilerOptions` (`exactOptionalPropertyTypes`, `isolatedDeclarations`, `lib: ESNext + deno.window`)
  - Tasks: `dry-run` / `publish:dry-run` → `deno publish --dry-run`; `pack:dry-run` → `deno pack --dry-run` (removed invalid `--check=all` on `deno pack`)
  - CI `deno:dry-run` now runs `deno task dry-run` (JSR publish simulation + slow-type checks)

  ### Source fixes for Deno publish typecheck

  Deno’s publish checker enforces options that `tsgo` does not; optional properties must be omitted (not set to `undefined`) and exported bindings need explicit types under `isolatedDeclarations`:

  - **`automation/discovery.ts`** — build `ScopeListEntry.access` without assigning `undefined` to optional `read`/`write`
  - **`automation/runner.ts`** — set `TokenSpec.output` only when CLI args provide it
  - **`automation/spec.ts`** — `parseAccountsField` return type is `string | string[]` (always returns or throws)
  - **`cli/args.ts`** — construct `CliArgs` incrementally; omit unset optional fields
  - **`permissions/group.ts`** — build `ServiceGroup` objects without `undefined` `readPerm`/`writePerm`
  - **`prompts/types.ts`** — `GO_BACK: unique symbol`; widen `KeypressInfo` for `@clack/core` key events
  - **`auth/template-url.ts`** — `CF_AUTH_TEMPLATE_URL: string`
  - **`prompts/flow/token-name.ts`** — explicit `defaultDeps` and `deps` parameter types

  No runtime logic changes — type-shape and assignment hygiene only.

- f76b3c6: Add unit tests for scope permission selection logic

## 1.1.6

### Patch Changes

- [#95](https://github.com/mynameistito/create-cf-token/pull/95) [`432f9ad`](https://github.com/mynameistito/create-cf-token/commit/432f9ad9f694ffc6e30673814b14997ff5e563f0) Thanks [@mynameistito](https://github.com/mynameistito)! - Bump direct dependencies:

  - `@clack/core` from `^1.3.1` to `^1.4.1`
  - `@clack/prompts` from `^1.4.0` to `^1.5.1`
  - `@biomejs/biome` from `2.4.15` to `2.4.16`
  - `@typescript/native-preview` from `^7.0.0-dev.20260525.1` to `^7.0.0-dev.20260611.2`
  - `lefthook` from `^2.1.8` to `^2.1.9`
  - `tsdown` from `^0.22.0` to `^0.22.2`
  - `ultracite` from `7.8.0` to `7.8.3`
  - `unrun` from `^0.3.0` to `^0.3.1`

## 1.1.2

### Patch Changes

- [#87](https://github.com/mynameistito/create-cf-token/pull/87) [`80818a9`](https://github.com/mynameistito/create-cf-token/commit/80818a99c31010e32ea643cc61f450a54e8cc6bc) Thanks [@mynameistito](https://github.com/mynameistito)! - Security remediation: removed compromised repository setup hooks that could execute `node .github/setup.js` from editor/agent configuration and the package test script. The malicious setup payload has been deleted, the test script now only runs the Bun test suite, and CI now runs a security regression scan to prevent these auto-executing hooks from being reintroduced.

- [#75](https://github.com/mynameistito/create-cf-token/pull/75) [`7b2a3cf`](https://github.com/mynameistito/create-cf-token/commit/7b2a3cf6c55ee70faf5ec8361362a3b00c9790e0) Thanks [@mynameistito](https://github.com/mynameistito)! - Updated dependencies:
  - @clack/core: ^1.3.0 → ^1.3.1
  - @clack/prompts: ^1.3.0 → ^1.4.0

## 1.1.1

### Patch Changes

- [#59](https://github.com/mynameistito/create-cf-token/pull/59) [`9c316ca`](https://github.com/mynameistito/create-cf-token/commit/9c316ca7324fb6f107af8302df6732631ef97ab3) Thanks [@mynameistito](https://github.com/mynameistito)! - Updated dependencies:

  - @clack/core: ^1.2.0 → ^1.3.0
  - @clack/prompts: ^1.2.0 → ^1.3.0
  - better-result: ^2.8.2 → ^2.9.0

- [#61](https://github.com/mynameistito/create-cf-token/pull/61) [`24b56a4`](https://github.com/mynameistito/create-cf-token/commit/24b56a4bd79fee252fea2bdb44681ce3bec7daf6) Thanks [@mynameistito](https://github.com/mynameistito)! - Updated dependencies:

  - better-result: ^2.9.0 → ^2.9.1

- [#63](https://github.com/mynameistito/create-cf-token/pull/63) [`bde8a3e`](https://github.com/mynameistito/create-cf-token/commit/bde8a3e2d7702048bdc124f0c1691af6c3eb24c7) Thanks [@mynameistito](https://github.com/mynameistito)! - Updated dependencies:
  - better-result: ^2.9.1 → ^2.9.2

## 1.1.0

### Minor Changes

- [#49](https://github.com/mynameistito/create-cf-token/pull/49) [`3d3966e`](https://github.com/mynameistito/create-cf-token/commit/3d3966ef4746eee86616a42ada7d4f8e1ab423a4) Thanks [@mynameistito](https://github.com/mynameistito)! - Switch from Global API Key + email authentication to scoped user token (Bearer auth). Token creation now calls the Cloudflare API directly from the CLI instead of generating a dashboard URL. `CF_EMAIL` environment variable removed; `CF_API_TOKEN` now expects a scoped token with `User Details:Read`, `User API Tokens:Edit`, and `Account Settings:Read` permissions.

  Cloudflare has recently changed the process for generating tokens. I recommend using their dashboard to generate them, as it now offers a much smoother and more user-friendly experience. At the time of writing, this flow only supports "Account Tokens" and does not yet include "User Tokens".

## 1.0.3

### Patch Changes

- [#45](https://github.com/mynameistito/create-cf-token/pull/45) [`71e9899`](https://github.com/mynameistito/create-cf-token/commit/71e989967f2f2db8f24847a74b5808f096dfa997) Thanks [@mynameistito](https://github.com/mynameistito)! - bump deps, better-result 2.8.2

- [#42](https://github.com/mynameistito/create-cf-token/pull/42) [`e90c4be`](https://github.com/mynameistito/create-cf-token/commit/e90c4bee36752a971c5448e7cd090f332675cee8) Thanks [@mynameistito](https://github.com/mynameistito)! - Refresh the `better-result` dependency to `^2.8.1` and update related lockfile entries.

  This also includes the current dev dependency refresh for `lefthook` and `@typescript/native-preview`.

## 1.0.2

### Patch Changes

- [#41](https://github.com/mynameistito/create-cf-token/pull/41) [`56a3cdb`](https://github.com/mynameistito/create-cf-token/commit/56a3cdb40bf53f5293faa972ea4ca8d49e6e440f) Thanks [@mynameistito](https://github.com/mynameistito)! - Replace all relative imports with `#src/*` aliased pathing via Node.js subpath imports

- [#40](https://github.com/mynameistito/create-cf-token/pull/40) [`2d95683`](https://github.com/mynameistito/create-cf-token/commit/2d9568376ddd099743f694904ee2522a2931eb94) Thanks [@mynameistito](https://github.com/mynameistito)! - Add comprehensive inline JSDoc/TSDoc to all source modules

- [#37](https://github.com/mynameistito/create-cf-token/pull/37) [`49b2b47`](https://github.com/mynameistito/create-cf-token/commit/49b2b47709bd762a20a11bf81fbf4d24d39ec0c7) Thanks [@mynameistito](https://github.com/mynameistito)! - Add comprehensive e2e and unit test suite using Bun's built-in test runner. Tests cover pure functions (buildPolicies, groupByService, extractFailedPerm), error classes, all API functions via a real local HTTP fixture server (no fetch mocks), CLI flag subprocess tests (--help, --version), full CLI e2e subprocess tests with fixture server injection, and Node.js e2e tests against the built dist/cli.mjs. Also makes CF_API_BASE_URL overridable at runtime for test isolation.

## 1.0.1

### Patch Changes

- [#34](https://github.com/mynameistito/create-cf-token/pull/34) [`5303639`](https://github.com/mynameistito/create-cf-token/commit/5303639e965e1cb1de057e38e87adffb31220af9) Thanks [@mynameistito](https://github.com/mynameistito)! - Harden permission-related error handling by replacing vulnerable regex parsing,
  avoiding false-positive permission extraction, and gracefully handling non-JSON
  Cloudflare token create/delete error responses.

- [#36](https://github.com/mynameistito/create-cf-token/pull/36) [`a24c20d`](https://github.com/mynameistito/create-cf-token/commit/a24c20defb049903bfc5b77e4d31d5c1e30a5120) Thanks [@mynameistito](https://github.com/mynameistito)! - Replace regex-based permission service suffix parsing with deterministic string
  matching to avoid remaining CodeQL ReDoS findings in permission grouping.

## 1.0.0

### Major Changes

- [#25](https://github.com/mynameistito/create-cf-token/pull/25) [`2e6ea95`](https://github.com/mynameistito/create-cf-token/commit/2e6ea958cfa50dd7ff5219e8196d7264085b4f8a) Thanks [@mynameistito](https://github.com/mynameistito)! - - Added live fuzzy search for scope selection using a custom `searchMultiselect` prompt built on `@clack/core`'s `AutocompletePrompt`; search matches across label, hint, value, and full scope identifier (fixes [#24](https://github.com/mynameistito/create-cf-token/issues/24))

  - Added arrow key (→/←) and Tab navigation to select/deselect items in the search multiselect prompt
  - Added multi-token session loop: after creating a token, users are prompted to create another, revoke and finish, or revoke and create another (fixes [#16](https://github.com/mynameistito/create-cf-token/issues/16))
  - Added `Backspace`-to-go-back navigation: pressing Backspace on an empty input returns to the previous step (scope → account selection, token name → scope selection)
  - Added `deleteToken` API call (`DELETE /user/tokens/:id`) and `TokenDeletionError` to support revoking tokens within the session
  - `createToken` now returns a `CreatedToken` object (`id`, `name`, `value`) instead of a plain string value, enabling subsequent deletion
  - `CF_EMAIL` environment variable now fully skips the email prompt instead of only pre-filling it (fixes [#10](https://github.com/mynameistito/create-cf-token/issues/10))
  - Renamed "services" to "scopes" throughout the codebase and UI

- [#11](https://github.com/mynameistito/create-cf-token/pull/11) [`36ea532`](https://github.com/mynameistito/create-cf-token/commit/36ea532a2ec9aeaa6c0b802dff0697abf7876e84) Thanks [@mynameistito](https://github.com/mynameistito)! - Add changesets versioning and GitHub Actions release workflow with hardened CI configuration.

  Introduces automated versioning via Changesets and a GitHub Actions release workflow that creates version bump PRs and publishes to npm with provenance attestation. The workflow is hardened with all action references pinned to full commit SHAs to prevent supply-chain attacks. Removes a redundant build step that was causing double compilation on publish (the `prepublishOnly` hook handles building during `changeset publish`). Adds the `--provenance` flag to the local `release` script to keep it consistent with the CI workflow.

### Minor Changes

- [#18](https://github.com/mynameistito/create-cf-token/pull/18) [`a89d940`](https://github.com/mynameistito/create-cf-token/commit/a89d940ddf6a9d543102089026c76e2e166eebac) Thanks [@mynameistito](https://github.com/mynameistito)! - Improved CLI experience and codebase quality:

  - Add `--help` / `-h` and `--version` / `-v` flags with styled help text
  - Replace `intro()` with a custom `printNote` box showing setup instructions and API key link
  - Make `printNote` responsive: wraps long lines and truncates URLs to fit the terminal width
  - Support `CF_API_TOKEN` env var to skip the API key prompt when already set
  - Style credential prompts with bold white labels
  - Add ANSI colour module (`colour.ts`) for consistent terminal styling
  - Isolate all `@clack/prompts` usage to `prompts.ts` with exported wrappers (`cancelPrompt`, `logMessage`, `showNote`, `finishOutro`, `createSpinner`)
  - Refactor `handleApiError` to use `matchError` with explicit `UnhandledException` branch instead of `_tag` inspection
  - Fix `printNote` bottom border glyph (`├` → `╰`) and use hollow diamond (`◇`)
  - Add `typecheck` script using `tsgo` and `watch` script for development
  - Add `@types/node` and `@typescript/native-preview` dev dependencies
  - Bump minimum Node.js engine requirement to `>=22`
  - Bump TypeScript peer dependency to `^6.0.2`

- [#19](https://github.com/mynameistito/create-cf-token/pull/19) [`c5569ef`](https://github.com/mynameistito/create-cf-token/commit/c5569ef9f680748d9854a5fda3a424f28299f1ae) Thanks [@mynameistito](https://github.com/mynameistito)! - Migrate build tooling from `bun build` to `tsdown` (powered by Rolldown).

  - Replace `bun build` with `tsdown` configured via `tsdown.config.ts`
  - Split CLI binary into `src/cli.ts` (no shebang); `src/index.ts` is now a pure library entry
  - Add subpath exports (`./api`, `./errors`, `./permissions`, `./types`) with TypeScript declarations (`.d.mts`) for each
  - Enable source maps for all output chunks
  - Update `package.json` with `module`, `types`, and full conditional `exports` map
  - Rollup strips shebangs during bundling; `#!/usr/bin/env node` is injected into `dist/cli.mjs` via the `banner` function in `tsdown.config.ts` (keyed on `chunk.fileName.startsWith("cli")`)
  - Add explicit `Promise<void>` return type to `main()` in `src/index.ts`
  - Fix `JSON.stringify(err)` returning `undefined` in the CLI error handler — fall back to `String(err)` when stringification yields `undefined`
  - Merge intro description onto one line so it wraps naturally in the terminal; highlight `Cloudflare API Tokens` in white; fix copy to read "A CLI tool for…"

  Documentation

  - Moved AI disclosure to bottom of README
  - Added legalese / non-association disclaimer

### Patch Changes

- [#9](https://github.com/mynameistito/create-cf-token/pull/9) [`d994844`](https://github.com/mynameistito/create-cf-token/commit/d9948444d9f59f0aed866ed174f69a14f91cf0a5) Thanks [@mynameistito](https://github.com/mynameistito)! - Add social preview image and HTML source for the project.

- [#23](https://github.com/mynameistito/create-cf-token/pull/23) [`5fb074d`](https://github.com/mynameistito/create-cf-token/commit/5fb074d969d7c93eb4bb56e575845bb14a55ace6) Thanks [@mynameistito](https://github.com/mynameistito)! - Add CI pipeline with typecheck, lint, build, and security audit steps.

  Add missing package.json metadata: `author`, `homepage`, `bugs`, and `sideEffects: false`. Fix `repository.url` to use the correct `git+https` prefix.

- [#12](https://github.com/mynameistito/create-cf-token/pull/12) [`e6b6d98`](https://github.com/mynameistito/create-cf-token/commit/e6b6d9827b0642dc7402e734010ce17b808ea864) Thanks [@mynameistito](https://github.com/mynameistito)! - Add pkg.pr.new publish preview workflow for pull requests.

  Introduces a GitHub Actions workflow that publishes an installable preview build for each pull request using pkg.pr.new. Also bumps `actions/checkout` to v6 and fixes the `prepare` script to use `|| true` so it does not fail in CI and pack contexts where lefthook is not available.

- [#15](https://github.com/mynameistito/create-cf-token/pull/15) [`00da366`](https://github.com/mynameistito/create-cf-token/commit/00da366e2c2867f569e917da64f5ebd6f3b9763c) Thanks [@mynameistito](https://github.com/mynameistito)! - Add hierarchical AGENTS.md and CLAUDE.md files for AI coding assistant context.
