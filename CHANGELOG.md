# create-cf-token

## 1.2.0

### Minor Changes

- [#128](https://github.com/mynameistito/create-cf-token/pull/128) [`3e677a7`](https://github.com/mynameistito/create-cf-token/commit/3e677a7e60327288ec9293c8fc3fc3c73c1646ad) Thanks [@mynameistito](https://github.com/mynameistito)! - Add a one-click full-access preset (all accounts, all scopes, read + write), Select All shortcuts in multiselect prompts, a bulk access-level prompt when every scope is selected manually, and exclude API token management permissions that sub-tokens cannot grant (fixes [#127](https://github.com/mynameistito/create-cf-token/issues/127))

- [#102](https://github.com/mynameistito/create-cf-token/pull/102) [`956e590`](https://github.com/mynameistito/create-cf-token/commit/956e59038700b4443a914091e0d5ce9056dff02e) Thanks [@mynameistito](https://github.com/mynameistito)! - Fix CLI runtime stability and update the project linting setup for the current Ultracite Oxlint/Oxfmt toolchain.

  This release fixes Cloudflare API error construction with the installed `better-result` version, prevents non-interactive CLI runs from hanging when prompts cannot read from a TTY, and restores the generated CLI shebang in the built `dist/cli.mjs` output.

  It also updates tests and source formatting to satisfy the current Ultracite ruleset, including Unicode-aware regular expressions, sorted object keys, async subprocess handling, and deterministic E2E behavior for Bun and Node subprocess tests.

- [#125](https://github.com/mynameistito/create-cf-token/pull/125) [`70892bf`](https://github.com/mynameistito/create-cf-token/commit/70892bfeb90b8d4266df1396e31597fe81c4f115) Thanks [@mynameistito](https://github.com/mynameistito)! - Restore restricted-permission retry and session token revoke flows

- [#132](https://github.com/mynameistito/create-cf-token/pull/132) [`6ebc803`](https://github.com/mynameistito/create-cf-token/commit/6ebc8037c778f66f1293bbe03182958d5fd55bee) Thanks [@mynameistito](https://github.com/mynameistito)! - Add non-interactive token creation, scope discovery, agent skill, and programmatic API exports.

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

  Closes [#131](https://github.com/mynameistito/create-cf-token/issues/131).

### Patch Changes

- [#130](https://github.com/mynameistito/create-cf-token/pull/130) [`ba6b939`](https://github.com/mynameistito/create-cf-token/commit/ba6b939fab133e0c633f1978689e10020e922946) Thanks [@mynameistito](https://github.com/mynameistito)! - Remove redundant exit delete prompt after keeping a token; clarify post-create action labels (fixes [#129](https://github.com/mynameistito/create-cf-token/issues/129))

- [#119](https://github.com/mynameistito/create-cf-token/pull/119) [`06f79bf`](https://github.com/mynameistito/create-cf-token/commit/06f79bf79edb8b7afe860bdfb10f2c0ffdabfff8) Thanks [@mynameistito](https://github.com/mynameistito)! - Remove unused showNote export from prompts module

- [#120](https://github.com/mynameistito/create-cf-token/pull/120) [`687775b`](https://github.com/mynameistito/create-cf-token/commit/687775b841d5ce3321c066b21af03c34ce20e354) Thanks [@mynameistito](https://github.com/mynameistito)! - Add knip configuration so CI knip job passes

- [#116](https://github.com/mynameistito/create-cf-token/pull/116) [`f77f903`](https://github.com/mynameistito/create-cf-token/commit/f77f9033c35238af02c0a66be66a674a370e937f) Thanks [@mynameistito](https://github.com/mynameistito)! - Sync README and SECURITY docs to scoped Bearer token authentication

- [#122](https://github.com/mynameistito/create-cf-token/pull/122) [`1240c8c`](https://github.com/mynameistito/create-cf-token/commit/1240c8c1deaf86c8eae71fa41441719942a76ca8) Thanks [@mynameistito](https://github.com/mynameistito)! - Sync AGENTS.md and CONTRIBUTING to current codebase

- [#117](https://github.com/mynameistito/create-cf-token/pull/117) [`4caa073`](https://github.com/mynameistito/create-cf-token/commit/4caa073a355b866fbfee93fd9f555fc1ba677351) Thanks [@mynameistito](https://github.com/mynameistito)! - Add typecheck job to CI pipeline

- [#124](https://github.com/mynameistito/create-cf-token/pull/124) [`86375a6`](https://github.com/mynameistito/create-cf-token/commit/86375a6f1853a5ae0583a8fe3b0fae0a79548866) Thanks [@mynameistito](https://github.com/mynameistito)! - Paginate Cloudflare account listing beyond the first 50 accounts

- [#123](https://github.com/mynameistito/create-cf-token/pull/123) [`90115c6`](https://github.com/mynameistito/create-cf-token/commit/90115c66250c7dec4ef55597e78d208437555f3e) Thanks [@mynameistito](https://github.com/mynameistito)! - Harden Cloudflare API error response parsing for malformed bodies

- [#121](https://github.com/mynameistito/create-cf-token/pull/121) [`2abd379`](https://github.com/mynameistito/create-cf-token/commit/2abd3795f684241f23783cafd4f27f148017cedc) Thanks [@mynameistito](https://github.com/mynameistito)! - Add unit tests for scope permission selection logic

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
