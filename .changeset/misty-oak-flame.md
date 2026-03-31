---
"create-cf-token": minor
---

Migrate build tooling from `bun build` to `tsdown` (powered by Rolldown).

- Replace `bun build` with `tsdown` configured via `tsdown.config.ts`
- Split CLI binary into `src/cli.ts`; `src/index.ts` is now a pure library entry
- Add subpath exports (`./api`, `./errors`, `./permissions`, `./types`) with TypeScript declarations (`.d.mts`) for each
- Enable source maps for all output chunks
- Update `package.json` with `module`, `types`, and full conditional `exports` map
