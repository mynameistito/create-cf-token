/**
 * @module prompts
 *
 * Interactive CLI prompt layer for the create-cf-token tool.
 *
 * All terminal interaction is isolated here — every `@clack/prompts` import
 * lives under this directory. Other modules call the exported functions to show
 * prompts and receive user input back, keeping UI concerns separated from
 * business logic.
 */

export {
  buildAuthTemplateUrl,
  CF_API_TOKENS_URL,
  CF_AUTH_TEMPLATE_URL,
} from "#src/auth/template-url.ts";
export { resolveFullAccessPermissions } from "#src/permissions/resolve.ts";
export { hyperlinkUrl } from "#src/terminal/hyperlink.ts";
export { printNote } from "#src/terminal/note.ts";

export { askCredentials } from "#src/prompts/flow/credentials.ts";
export { selectAccounts } from "#src/prompts/flow/accounts.ts";
export {
  askPostCreateAction,
  showCreatedToken,
} from "#src/prompts/flow/post-create.ts";
export { askTokenPreset } from "#src/prompts/flow/preset.ts";
export {
  buildPermissionsForSelection,
  selectScopes,
} from "#src/prompts/flow/scopes.ts";
export { askTokenName } from "#src/prompts/flow/token-name.ts";
export {
  cancelPrompt,
  createSpinner,
  finishOutro,
  logMessage,
} from "#src/prompts/logging.ts";
export { shouldToggleSelectAll } from "#src/prompts/primitives/search-multiselect.ts";
export { GO_BACK } from "#src/prompts/types.ts";
