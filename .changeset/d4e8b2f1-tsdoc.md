---
"create-cf-token": patch
---

Add comprehensive TSDoc across the public API and internal modules so IDE tooltips, generated docs, and JSR type documentation accurately describe behaviour.

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
