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
} from "@/auth/template-url.ts";
export { resolveFullAccessPermissions } from "@/permissions/resolve.ts";
export { hyperlinkUrl } from "@/terminal/hyperlink.ts";
export { printNote } from "@/terminal/note.ts";

export { askCredentials } from "@/prompts/flow/credentials.ts";
export { selectAccounts } from "@/prompts/flow/accounts.ts";
export {
  askPostCreateAction,
  showCreatedToken,
} from "@/prompts/flow/post-create.ts";
export { askTokenPreset } from "@/prompts/flow/preset.ts";
export {
  buildPermissionsForSelection,
  selectScopes,
} from "@/prompts/flow/scopes.ts";
export { askTokenName } from "@/prompts/flow/token-name.ts";
export {
  cancelPrompt,
  createSpinner,
  finishOutro,
  logMessage,
} from "@/prompts/logging.ts";
export { shouldToggleSelectAll } from "@/prompts/primitives/search-multiselect.ts";
export { GO_BACK } from "@/prompts/types.ts";
