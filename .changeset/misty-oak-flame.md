---
"create-cf-token": minor
---

Migrate build tooling from `bun build` to `tsdown` (powered by Rolldown).

- Replace `bun build` with `tsdown` configured via `tsdown.config.ts`
- Split CLI binary into `src/cli.ts` (no shebang); `src/index.ts` is now a pure library entry
- Add subpath exports (`./api`, `./errors`, `./permissions`, `./types`) with TypeScript declarations (`.d.mts`) for each
- Enable source maps for all output chunks
- Update `package.json` with `module`, `types`, and full conditional `exports` map
- Rollup strips shebangs during bundling; `#!/usr/bin/env node` is injected into `dist/cli.mjs` via the `banner` function in `tsdown.config.ts` (keyed on `chunk.fileName.startsWith("cli")`)
- Add explicit `Promise<void>` return type to `main()` in `src/index.ts`
- Fix `JSON.stringify(err)` returning `undefined` in the CLI error handler — fall back to `String(err)` when stringification yields `undefined`
- Merge intro description onto one line so it wraps naturally in the terminal; highlight `Cloudflare API Tokens` in white; fix copy to read "A CLI tool for…"
