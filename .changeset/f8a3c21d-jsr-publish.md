---
"create-cf-token": patch
---

Add automated JSR publishing, keep `deno.json` in sync with `package.json`, and align source with Deno’s stricter publish typechecker.

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
