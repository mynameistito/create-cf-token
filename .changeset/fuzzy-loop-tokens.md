---
"create-cf-token": major
---

- Added live fuzzy search for scope selection using a custom `searchMultiselect` prompt built on `@clack/core`'s `AutocompletePrompt`; search matches across label, hint, value, and full scope identifier (fixes #24)
- Added arrow key (→/←) and Tab navigation to select/deselect items in the search multiselect prompt
- Added multi-token session loop: after creating a token, users are prompted to create another, revoke and finish, or revoke and create another (fixes #16)
- Added `Backspace`-to-go-back navigation: pressing Backspace on an empty input returns to the previous step (scope → account selection, token name → scope selection)
- Added `deleteToken` API call (`DELETE /user/tokens/:id`) and `TokenDeletionError` to support revoking tokens within the session
- `createToken` now returns a `CreatedToken` object (`id`, `name`, `value`) instead of a plain string value, enabling subsequent deletion
- `CF_EMAIL` environment variable now fully skips the email prompt instead of only pre-filling it (fixes #10)
- Renamed "services" to "scopes" throughout the codebase and UI
