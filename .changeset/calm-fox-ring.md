---
"create-cf-token": minor
---

Improved CLI experience and codebase quality:

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
