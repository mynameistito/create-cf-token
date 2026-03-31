---
"create-cf-token": minor
---

Improved CLI experience and codebase quality:

- Add `--help` / `-h` and `--version` / `-v` flags with styled help text
- Replace `intro()` with a custom `printNote` box showing setup instructions and API key link
- Style credential prompts with bold white labels
- Add ANSI colour module (`colour.ts`) for consistent terminal styling
- Isolate all `@clack/prompts` usage to `prompts.ts` with exported wrappers (`cancelPrompt`, `logMessage`, `showNote`, `finishOutro`, `createSpinner`)
- Refactor `handleApiError` to use `matchError` instead of direct `_tag` inspection
- Fix `printNote` bottom border glyph (`├` → `╰`) and use hollow diamond (`◇`)
- Add `typecheck` script using `tsgo` and `watch` script for development
- Add `@types/node` and `@typescript/native-preview` dev dependencies
