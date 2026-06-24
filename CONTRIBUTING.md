# Contributing

Thanks for taking the time to contribute!

> **Note:** This project is not affiliated with or endorsed by Cloudflare, Inc. It is an independent tool that interacts with the Cloudflare API.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0.0 **or** Node.js ≥ 22.0.0
- A scoped Cloudflare **API token** (`CF_API_TOKEN`) with `User Details:Read`, `User API Tokens:Edit`, and `Account Settings:Read` permissions to test against a real account

## Setup

```sh
git clone https://github.com/mynameistito/create-cf-token.git
cd create-cf-token
bun install
```

Pre-commit hooks are managed by [Lefthook](https://github.com/evilmartians/lefthook) and run automatically on commit:

- **Lint & format** (`ultracite fix`) — auto-fixes JS/TS/JSON files
- **Type check** (`tsgo --noEmit`) — TypeScript validation on changed `.ts` files

If a hook fails, fix the reported issue before re-committing. Do **not** use `--no-verify` to bypass hooks.

## Project Structure

```text
src/
  cli.ts          # Shebang entry point — parses args and runs the interactive flow
  index.ts        # Core orchestration — account/scope selection, token creation
  prompts.ts      # All interactive prompt definitions (@clack/prompts)
  permissions.ts  # Cloudflare permission definitions and groupings
  api.ts          # Cloudflare API client (token CRUD, account listing)
  types.ts        # Shared TypeScript types
  errors.ts       # Tagged error types
  colour.ts       # Terminal colour helpers
```

## Development

```sh
bun run dev       # run the CLI from source
bun run build     # build with tsdown
bun run typecheck # type-check with tsgo
bun run check     # lint with Biome/Ultracite (report only)
bun run fix       # lint + auto-fix
```

## Coding Conventions

- **ESM only** — all files use `import`/`export`; no `require()`.
- **Result types** — use `better-result` tagged errors instead of thrown exceptions. Add new error tags to `src/errors.ts`.
- **No external runtime deps** unless strictly necessary. The only runtime dependencies are `@clack/core`, `@clack/prompts`, and `better-result`.
- **Formatting/linting** is enforced by Biome via Ultracite. Run `bun run fix` to auto-fix before committing.

## Submitting a PR

**Every PR must be linked to an open issue.** If one doesn't exist yet, open it first and wait for a brief acknowledgement before investing time in an implementation.

1. Open or find the relevant issue.
2. Fork the repo and create a branch from `main`.
3. Make your changes.
4. Add a changeset describing your change:

   ```sh
   bunx changeset
   ```

   Choose the correct bump type:
   - `patch` — bug fixes, documentation, internal refactors with no behavior change
   - `minor` — new flags, new prompt steps, backwards-compatible features
   - `major` — breaking changes to the CLI interface or behavior

5. Open a pull request against `main` and reference the issue (`Closes #123`) in the PR description.

> PRs without a changeset will not be merged unless they are non-user-facing (e.g. CI config, internal refactors with no behavior change).

### PR checklist

- [ ] Linked to an open issue
- [ ] `bun run typecheck` passes
- [ ] `bun run check` passes
- [ ] Changeset added (if user-facing)
- [ ] PR description explains _what_ and _why_, not just _what_

## AI-Assisted Contributions

AI-assisted contributions are welcome. However:

- **Do not paste raw AI output** into PR descriptions or issue reports.
- Descriptions must be **accurate, concise, and human-reviewed**.
- Sloppy or generic AI-generated descriptions will be sent back for revision.

## Commit Style

Use short, imperative commit messages (e.g. `fix: handle missing scope in retry`). Prefix with a type: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.

## CI

CI runs on every push and PR to `main` as a matrix of jobs (Node 22, Bun 1.3.14):

1. **bun:audit** — `bun audit`
2. **build** — production build via tsdown
3. **check** — lint and format via Ultracite
4. **knip** — unused export detection
5. **test** — `bun test`
6. **test:e2e-node-22** / **test:e2e-node-24** — build + Node E2E test against `dist/cli.mjs`
7. **test:security** — security regression tests

All matrix jobs must pass for a PR to be mergeable. Type-checking (`bun run typecheck`) runs in the pre-commit hook, not CI.

## Release Process

Releases are automated via [Changesets](https://github.com/changesets/changesets) and the `release.yml` workflow:

1. Merging a PR with changeset files to `main` opens or updates a **chore: version packages** PR (`changeset-release/main`).
2. Merge that PR into `main` with **Rebase and merge** so verified version commits satisfy the repository’s required-signatures ruleset.
3. Merging the version packages PR triggers `release.yml` again; with no pending changesets, the workflow stages the npm publish (with provenance) and creates the GitHub release. A maintainer must then approve the staged publish on [npmjs.com](https://www.npmjs.com/) (including 2FA) before the version is publicly installable.

All release automation runs on `main` only. The legacy `staging` branch is no longer used; branch rulesets protect `main` (and `changeset-release/*` is excluded from required signatures). No ruleset changes are needed when removing a local `staging` branch.

Version bumps on the version packages PR use `commitMode: github-api` in the Changesets action so commits are GPG-signed by GitHub. Do not switch this back to the default `git-cli` mode — unsigned bot commits cannot merge into `main`.

You do not need to manually run `changeset version` or publish to npm.
