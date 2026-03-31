# create-cf-token

**Generated:** 2026-03-31
**Commit:** b1083d0
**Branch:** main

## OVERVIEW

CLI tool for creating Cloudflare API tokens with interactive guided prompts. TypeScript/ESM, runs on Bun and Node >= 18. Published to npm as `create-cf-token`.

## STRUCTURE

```
.
├── src/              # All source code (6 files)
│   ├── index.ts      # CLI entry point + orchestration + retry logic
│   ├── api.ts        # Cloudflare REST API wrappers (fetch, no SDK)
│   ├── errors.ts     # TaggedError hierarchy (better-result)
│   ├── permissions.ts # groupByService utility
│   ├── prompts.ts    # @clack/prompts interactive UI
│   └── types.ts      # Shared type definitions
├── .changeset/       # Pending version bumps
├── .claude/          # Claude Code hooks + skills
├── .github/workflows/ # release.yml, publish-preview.yml
├── dist/             # Build output (gitignored, published to npm)
└── opensrc/          # Downloaded dependency source (gitignored)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new API call | `src/api.ts` | Must return `Result<T, E>` via `Result.tryPromise` |
| Add a new error type | `src/errors.ts` | Use `TaggedError` from `better-result` |
| Add/modify CLI prompts | `src/prompts.ts` | All `@clack/prompts` calls isolated here |
| Change token creation flow | `src/index.ts` | `main()` function orchestrates everything |
| Add shared types | `src/types.ts` | API response types, input types |
| Permission grouping logic | `src/permissions.ts` | `groupByService()`, `extractFailedPerm()` |

## CONVENTIONS

- **Error handling**: `better-result` TaggedError everywhere. API functions return `Result<T, E>`, never throw. `handleApiError` in index.ts is `never`-returning.
- **UI isolation**: Only `prompts.ts` imports `@clack/prompts`. Other modules never touch the terminal.
- **No SDK**: Cloudflare API called via raw `fetch`. No `@cloudflare/workers-types` or CF SDK.
- **Build**: `tsdown` (configured in `tsdown.config.ts`). TypeScript is type-check only (`noEmit: true`). No tsc in build pipeline. The shebang (`#!/usr/bin/env node`) is injected via `banner.js` since Rolldown strips it during bundling.
- **Module resolution**: `module: "Preserve"`, `moduleResolution: "bundler"`. `.ts` extension imports allowed.
- **Process env**: `process.env.CF_EMAIL` used as initial value for email prompt (`prompts.ts`).

## ANTI-PATTERNS (THIS PROJECT)

- Throwing raw strings or non-Error values in catch blocks
- Calling `@clack/prompts` from outside `prompts.ts`
- Adding `.tsx` or React dependencies (pure CLI, no JSX)
- Using `tsc` for compilation (Bun handles bundling)
- Adding barrel index re-exports in `src/`

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `main()` | function | `src/index.ts` | CLI orchestrator |
| `handleApiError()` | function | `src/index.ts` | Never-returning error handler |
| `buildPolicies()` | function | `src/index.ts` | Constructs API policy objects |
| `cfGet()` | function | `src/api.ts` | Internal GET helper (not exported) |
| `getUser()` | function | `src/api.ts` | GET /user |
| `getAccounts()` | function | `src/api.ts` | GET /accounts |
| `getPermissionGroups()` | function | `src/api.ts` | GET /user/tokens/permission_groups |
| `createToken()` | function | `src/api.ts` | POST /user/tokens |
| `CloudflareApiError` | class | `src/errors.ts` | Base TaggedError |
| `TokenCreationError` | class | `src/errors.ts` | Token create failed |
| `RestrictedPermissionError` | class | `src/errors.ts` | Restricted permission exclusion |
| `groupByService()` | function | `src/permissions.ts` | Groups perms by service |
| `extractFailedPerm()` | function | `src/permissions.ts` | Error message helper |

## COMMANDS

```bash
bun start                    # Run CLI from source
bun run build                # Build to dist/
bun x ultracite check        # Lint + format check
bun x ultracite fix          # Auto-fix lint + format
bun run changeset            # Create version changeset
bun run release              # Build + publish to npm
```

## NOTES

- No test framework installed. Bun's built-in `bun test` is available but unused.
- No type-check step in CI. Type errors won't block builds.
- `CF_EMAIL` env var (optional) pre-fills the email prompt.
- `process.env.CF_API_TOKEN` is used at runtime for API authentication (not committed).
- Pre-commit hook auto-fixes + stages formatting via Lefthook.
- Preview packages published on every PR via `pkg-pr-new` (`bunx create-cf-token@pr-N`).

---

## TOOLCHAIN

- **Ultracite Code Standards**: See below. Run `bun x ultracite fix` before committing.

## Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

### Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

### Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

#### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

#### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

#### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

#### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

#### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

#### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
