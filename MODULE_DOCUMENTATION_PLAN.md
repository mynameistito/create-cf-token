# Module Documentation Plan

## Objective

Produce complete module documentation for the runtime code in `src/`, covering every meaningful exported and internal function, class, constant, interface, type alias, and control-flow boundary. The documentation should be good enough that a new contributor can understand how the CLI works without reverse-engineering the implementation from scratch.

This repo is small, but the documentation task is not trivial because:

- `src/prompts.ts` has a large internal helper surface.
- `src/index.ts` contains most of the workflow orchestration and retry logic.
- The package exposes some files publicly through `package.json` exports, while other modules are CLI-internal.
- The codebase relies heavily on typed `Result` flows and tagged errors, which need to be explained clearly.

## What “Complete” Means Here

The final documentation set should cover all of the following:

1. Every runtime source module in `src/`.
2. Every exported symbol.
3. Every internal function and internal type/interface that materially affects behavior.
4. Module responsibilities and boundaries.
5. Cross-module dependencies and data flow.
6. Error handling behavior, especially `better-result` usage.
7. Environment variables and side effects.
8. Behavior verified by tests where the implementation alone is easy to misread.

For this codebase, “all functions and types etc.” means documenting at least:

- Functions
- Classes
- Interfaces
- Type aliases
- Exported constants
- Important internal constants and regex/config values when they shape behavior
- Important module-level control-flow decisions

## Recommended Output Structure

Create a new docs area instead of stuffing this into the main README.

Recommended files:

1. `docs/modules/README.md`
2. `docs/modules/symbol-index.md`
3. `docs/modules/api.md`
4. `docs/modules/cli.md`
5. `docs/modules/colour.md`
6. `docs/modules/errors.md`
7. `docs/modules/index.md`
8. `docs/modules/permissions.md`
9. `docs/modules/prompts.md`
10. `docs/modules/types.md`

If desired, add one extra page:

11. `docs/modules/architecture.md`

The module pages should map 1:1 to the source files in `src/`. That makes future maintenance much easier.

## Documentation Standard For Each Module Page

Every module page should use the same structure so the set feels coherent.

Required sections:

1. Purpose
2. Why this module exists
3. Public vs internal surface
4. Imports and dependencies
5. Symbol reference
6. Control flow or data flow
7. Error handling and side effects
8. Environment variables or process interaction
9. Related tests
10. Known caveats or implementation quirks

For each symbol, document these fields when applicable:

- Name
- Kind (`function`, `class`, `interface`, `type`, `const`)
- Signature or structural shape
- Exported or internal
- Called by / used by
- Purpose
- Inputs
- Output or return shape
- Error behavior
- Side effects
- Important invariants
- Notes or edge cases

## Style Rules For The Documentation Work

- Do not restate code mechanically; explain why the symbol exists and how it fits the flow.
- Distinguish package-public API from CLI-internal implementation details.
- When a function returns `Result<T, E>`, document both `Ok` and `Err` paths explicitly.
- When a function or helper can terminate the process, say so directly.
- For very small helpers in `src/prompts.ts`, it is fine to document them in grouped subsections, but every symbol still needs to appear somewhere in the symbol index.
- Use tests as evidence for behavior, not just the implementation.
- Do not invent guarantees the code does not actually provide.

## Source Material To Use

Primary sources:

- `README.md`
- `package.json`
- `src/*.ts`
- `__tests__/api.test.ts`
- `__tests__/permissions.test.ts`
- `__tests__/build-policies.test.ts`
- `__tests__/cli.flags.test.ts`
- `__tests__/import-all-coverage.test.ts`

Secondary sources that help with framing:

- `CONTRIBUTING.md`
- root `AGENTS.md`
- `src/AGENTS.md`

## High-Level Architecture To Capture

The docs should make this flow obvious:

1. `src/cli.ts` is the process entry point and dispatch guard.
2. `src/index.ts` handles flags and orchestrates the interactive token creation loop.
3. `src/prompts.ts` owns all terminal interaction and prompt rendering.
4. `src/api.ts` owns all Cloudflare HTTP calls.
5. `src/permissions.ts` transforms permission metadata and parses restricted-permission failures.
6. `src/errors.ts` defines tagged error types used across the API layer.
7. `src/types.ts` defines shared data shapes.
8. `src/colour.ts` provides ANSI escape constants used by the CLI output.

It would be useful for `docs/modules/README.md` or `docs/modules/architecture.md` to include a short Mermaid diagram showing these relationships.

## Module Coverage Matrix

This is the minimum symbol coverage expected from the documentation set.

### `src/cli.ts`

Document:

- `run`
- the `import.meta.main` entry-point guard

Explain:

- How `handleFlags()` short-circuits execution
- How `main().catch(handleCliError)` is wired
- Why this file is intentionally tiny

### `src/colour.ts`

Document:

- `colour`

Explain:

- Why it is a default export
- Which ANSI sequences are provided
- Which modules consume it

### `src/errors.ts`

Document:

- `CloudflareApiError`
- `TokenCreationError`
- `TokenDeletionError`
- `RestrictedPermissionError`

Explain:

- The `TaggedError` pattern
- Constructor behavior and generated `message` text
- Which module throws or returns each error
- Which callers pattern-match on them

### `src/types.ts`

Document:

- `PermissionGroup`
- `Account`
- `UserInfo`
- `CreatedToken`
- `Policy`
- `ServiceGroup`

Explain:

- Which types mirror Cloudflare payloads
- Which types are internal normalized shapes
- Which modules produce and consume each type

### `src/api.ts`

Document internal symbols:

- `TRAILING_SLASH_REGEX`
- `cfApiBase`
- `CloudflareErrorMessage`
- `CreateTokenResponse`
- `DeleteTokenResponse`
- `tryParseJson`
- `authHeaders`
- `cfGet`

Document exported symbols:

- `getUser`
- `getAccounts`
- `getPermissionGroups`
- `createToken`
- `deleteToken`

Explain in detail:

- Why `api.ts` is the only network layer
- `CF_API_BASE_URL` override behavior
- Shared auth header format
- How `cfGet` converts Cloudflare failures into `CloudflareApiError`
- Why `createToken` reads raw text before parsing JSON
- How `createToken` distinguishes restricted permissions from generic failures
- Why `createToken` falls back to scanning raw response text
- Why `deleteToken` returns `json.result?.id ?? tokenId`
- The exact `Result` error unions returned by each exported function

Behavior worth citing from tests:

- Header behavior
- Non-JSON failure handling
- Restricted-permission detection
- Success vs error result typing

### `src/permissions.ts`

Document internal constants and types:

- `PERMISSION_ACTION_SUFFIXES`
- `PERMISSION_GROUP_MARKERS`
- `LEADING_PERMISSION_DELIMITERS`
- `TRAILING_PERMISSION_DELIMITERS`
- `PermissionAction`

Document internal helpers:

- `matchPermissionAction`
- `stripPermissionActionSuffix`
- `hasPermissionAction`
- `normalizePermissionSource`
- `takePermissionValue`
- `extractFailedPermFromSource`

Document exported symbols:

- `groupByService`
- `extractFailedPerm`

Explain in detail:

- The grouping strategy for `Read`, `Write`, and `Edit`
- Case-insensitive suffix handling
- Why `Edit` is treated as `otherPerms`
- Why the service key is normalized but the first encountered name is preserved
- How multiple Cloudflare error text formats are supported
- Why escaped quotes and `\u0022` are normalized before parsing

Behavior worth citing from tests:

- Grouping behavior with mixed casing
- Leading whitespace handling
- Supported restricted-permission error formats

### `src/index.ts`

Document constants and types:

- `NAME`
- `VERSION`
- `TokenCreationFlowError`
- `TokenDeletionFlowError`
- `HELP_TEXT`
- `ApiError`

Document exported functions:

- `handleFlags`
- `buildPolicies`
- `handleApiError`
- `handleCliError`
- `main`

Document internal functions:

- `attemptCreateToken`
- `createTokenFlow`
- `deleteTokens`

Explain in detail:

- CLI help/version short-circuit behavior
- How `buildPolicies` splits user/account/zone permissions into separate policy entries
- Why zone permissions reuse account resources
- The retry loop in `attemptCreateToken`
- Why `API Tokens` starts in the excluded set
- What happens when all selected permissions become excluded
- How `createTokenFlow` supports backtracking through account selection, scope selection, and token naming
- How `main` fetches user, accounts, and permission groups before entering the token loop
- How the “modify this key” flow stores `previousToken` and deletes it on the next successful creation
- The fact that `handleApiError` and `handleCliError` terminate the process

Behavior worth citing from tests:

- `buildPolicies` behavior under exclusion
- flag parsing behavior
- importability expectations for source modules

### `src/prompts.ts`

This is the biggest documentation task and deserves its own worker.

Document exported constants:

- `CF_API_TOKENS_URL`
- `GO_BACK`

Document internal constants and basic helpers:

- `ANSI_RE`
- `SEARCH_SPLIT_RE`
- `strip`
- `gray`

Document internal types and interfaces:

- `CursorAction`
- `PromptState`
- `Backable`
- `PostCreateAction`
- `SearchOption`
- `KeypressInfo`
- `PromptViewState`
- `SearchPromptState`
- `SelectPromptState`
- `TextPromptState`

Document layout and formatting helpers:

- `truncateLine`
- `findSplitIndex`
- `wrapLine`
- `fuzzyIncludes`
- `matchesSearch`
- `getGuidePrefix`
- `getHeaderLines`
- `appendBackHint`
- `submitGoBack`
- `isBackspaceKey`

Document search/select render helpers:

- `renderSearchOption`
- `renderSelectOption`
- `getSearchMatchCount`
- `getSearchBodyLines`
- `getSearchFooterLines`
- `getSearchOptionsLines`
- `renderSearchPrompt`
- `getSelectedOptionLabel`
- `getSelectBodyLines`
- `getSelectFooterLines`
- `getSelectOptionsLines`
- `renderSelectPrompt`
- `getTextBodyLines`
- `getTextFooterLines`
- `renderTextPrompt`

Document exported prompt and output helpers:

- `printNote`
- `askCredentials`
- `selectAccounts`
- `selectScopes`
- `askTokenName`
- `askPostCreateAction`
- `cancelPrompt`
- `logMessage`
- `showNote`
- `finishOutro`
- `createSpinner`

Document internal prompt-flow helpers:

- `check`
- `searchMultiselect`
- `selectWithBack`
- `textWithBack`
- `buildScopeOptions`
- `buildPermissionsForSelection`

Explain in detail:

- The separation between UI logic and orchestration logic
- How back-navigation works via `GO_BACK`
- How cancellation works via `check()` and `process.exit(0)`
- How searchable multiselect is built on `@clack/core`
- The distinction between focused, selected, and filtered options
- Why scope selection is two-step: service selection first, read/write choice second
- How `printNote` adapts to terminal width
- Which helpers are pure formatting utilities vs stateful prompt wrappers

Important note for the docs:

- `searchMultiselect` has overloads and should be documented that way.
- `logMessage` is an exported object API, not a function.
- `GO_BACK` is a sentinel used across multiple prompt wrappers and in `index.ts`.

### `src/types.ts` + `src/errors.ts` Cross-Link Requirement

Even though they get separate pages, they should cross-link to each other and to `api.ts` and `index.ts`, because the error unions and data shapes are part of the same mental model.

## Public Surface vs Internal Surface

The docs should include a clear note that there are two different “surfaces” in this repo:

1. Published package exports from `package.json`
2. Internal CLI modules used by the bin entry point

Published package export map to document explicitly:

- `.`
- `./api`
- `./errors`
- `./permissions`
- `./types`

Important nuance to call out:

- The project is primarily a CLI, not a general-purpose library.
- `src/prompts.ts`, `src/cli.ts`, and `src/colour.ts` are not in the package export map.
- `src/index.ts` is exported as `.` by package configuration, but it mainly contains CLI orchestration utilities rather than a polished library API.

## Proposed Work Breakdown For Subagents

Use one coordinating agent plus five implementation subagents. The work can be parallelized after the scaffold is created.

### Coordinator

Responsibilities:

- Create the docs folder structure.
- Create `docs/modules/README.md`.
- Create `docs/modules/symbol-index.md`.
- Define the shared page template.
- Assign the module pages.
- Perform the final consistency pass.

### Subagent A: API, Types, Errors

Scope:

- `src/api.ts`
- `src/types.ts`
- `src/errors.ts`

Deliverables:

- `docs/modules/api.md`
- `docs/modules/types.md`
- `docs/modules/errors.md`

Focus areas:

- `Result` semantics
- tagged error taxonomy
- Cloudflare payload shapes
- env var override behavior
- documented examples from `__tests__/api.test.ts`

Suggested prompt:

```text
Document src/api.ts, src/types.ts, and src/errors.ts into docs/modules/api.md, docs/modules/types.md, and docs/modules/errors.md. Cover every exported and internal function/type/class listed in MODULE_DOCUMENTATION_PLAN.md. Use tests as evidence for behavior, explain Result unions precisely, and cross-link the error and type pages back to the API page.
```

### Subagent B: Orchestration and Entry Points

Scope:

- `src/index.ts`
- `src/cli.ts`

Deliverables:

- `docs/modules/index.md`
- `docs/modules/cli.md`

Focus areas:

- overall CLI flow
- flag handling
- policy construction
- retry loop
- process termination paths
- session token replacement behavior

Suggested prompt:

```text
Document src/index.ts and src/cli.ts into docs/modules/index.md and docs/modules/cli.md. Cover every exported and internal symbol listed in MODULE_DOCUMENTATION_PLAN.md, especially the retry loop, GO_BACK-driven flow transitions, buildPolicies behavior, and the process-exit behavior of error handlers.
```

### Subagent C: Permissions and Colour Utilities

Scope:

- `src/permissions.ts`
- `src/colour.ts`

Deliverables:

- `docs/modules/permissions.md`
- `docs/modules/colour.md`

Focus areas:

- permission grouping rules
- restricted-permission parsing pipeline
- case normalization and quote handling
- shared colour constants and their consumers

Suggested prompt:

```text
Document src/permissions.ts and src/colour.ts into docs/modules/permissions.md and docs/modules/colour.md. Cover every internal helper, exported function, type, and constant listed in MODULE_DOCUMENTATION_PLAN.md, and use __tests__/permissions.test.ts to anchor the documented behavior.
```

### Subagent D: Prompt System

Scope:

- `src/prompts.ts`

Deliverables:

- `docs/modules/prompts.md`

Focus areas:

- prompt architecture
- render pipeline
- search behavior
- back-navigation sentinel design
- terminal formatting behavior
- exported UI contract

Suggested prompt:

```text
Document src/prompts.ts into docs/modules/prompts.md. Cover every exported and internal symbol listed in MODULE_DOCUMENTATION_PLAN.md, including helper types, render helpers, prompt wrappers, and output utilities. Group tiny helpers sensibly, but do not skip any symbol. Explain how GO_BACK, check(), and the prompt overloads work.
```

### Subagent E: Architecture and Indexing

Scope:

- documentation-only synthesis across the repo

Deliverables:

- `docs/modules/README.md`
- `docs/modules/symbol-index.md`
- optional `docs/modules/architecture.md`

Focus areas:

- cross-module map
- public vs internal surface
- navigation entry points for readers
- quick summary of each module
- complete symbol inventory with links to module pages

Suggested prompt:

```text
Create docs/modules/README.md and docs/modules/symbol-index.md for this repo. Summarize how the modules fit together, separate published package exports from CLI-internal modules, and make sure every symbol listed in MODULE_DOCUMENTATION_PLAN.md appears in the index with a destination page.
```

### Coordinator Final Pass

After the workers finish, the coordinator should:

1. Verify naming consistency across pages.
2. Verify every symbol in this plan appears in the docs.
3. Verify every page links to related modules.
4. Remove duplicated explanations that belong in the overview page.
5. Ensure the docs consistently distinguish current behavior from inferred intent.

## Execution Order

Recommended sequence:

1. Coordinator creates the folder structure and page skeletons.
2. Subagents A, B, C, and D work in parallel.
3. Subagent E builds the overview and symbol index once page titles are known.
4. Coordinator runs the final editorial pass and gap check.

## Acceptance Criteria

The module documentation work is done only when all of the following are true:

1. Every `src/*.ts` runtime module has its own page.
2. Every symbol listed in this plan is documented.
3. Every exported function includes return behavior and error behavior.
4. Every module page explains who calls the module and what it depends on.
5. `docs/modules/symbol-index.md` lets a reader find any symbol quickly.
6. The docs explain the `better-result` pattern clearly.
7. The docs explain `GO_BACK`, process exits, retry behavior, and restricted-permission handling clearly.
8. The docs separate package-public exports from internal-only helpers.
9. The docs are grounded in code and tests, not speculation.

## Verification Checklist

The final coordinator should check the work with this checklist:

- Compare the docs against `rg -n "^(export )?(async )?function |^(export )?const |^(export )?class |^export interface |^type |^interface " src`
- Confirm every symbol in the grep output appears in the symbol index or module pages
- Confirm `package.json` export map is reflected accurately
- Confirm env vars are documented accurately: `CF_EMAIL`, `CF_API_TOKEN`, `CF_API_BASE_URL`
- Confirm tests cited in the docs actually support the statements they are attached to
- Confirm docs do not claim `prompts.ts` is package-public
- Confirm docs mention that `handleApiError` and `handleCliError` are `never`-returning in practice because they exit the process

## Nice-To-Have Additions

These are optional, not required for “done”:

- A Mermaid diagram of the token creation flow
- A Mermaid diagram of module dependencies
- A short “reading order” section for new contributors
- Tiny example snippets for the public package exports in `./api`, `./errors`, `./permissions`, and `./types`

## Summary For The Next Agent

The right way to do this is not “write a few high-level docs pages.” The right way is:

1. Create a docs/modules page for each runtime source file.
2. Build a symbol index that covers every function, type, class, and important constant.
3. Use tests to document real behavior and edge cases.
4. Give `src/prompts.ts` its own dedicated deep-dive page.
5. Finish with a coordinator pass that checks symbol completeness and cross-links.
