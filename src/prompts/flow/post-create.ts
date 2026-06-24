import { note, select } from "@clack/prompts";

import { CF_API_TOKENS_URL } from "@/auth/template-url.ts";
import { check, exitIfNonInteractive } from "@/prompts/guards.ts";
import type { PostCreateAction } from "@/prompts/types.ts";
import colour from "@/terminal/colour.ts";

/**
 * Ask what to do with a token that was just created.
 *
 * Options include keeping it, replacing it (revoke + recreate), deleting it,
 * or keeping it and starting another create flow.
 *
 * @returns The chosen post-create action.
 */
export async function askPostCreateAction(): Promise<PostCreateAction> {
  exitIfNonInteractive();
  return check(
    await select({
      initialValue: "done",
      message: "What should we do with the key you just created?",
      options: [
        { label: "Keep and finish", value: "done" },
        { label: "Replace this key", value: "revoke-again" },
        { label: "Delete this key", value: "revoke-done" },
        { label: "Keep and create another", value: "again" },
      ],
    })
  ) as PostCreateAction;
}

/**
 * Display the newly created token value in a note box.
 * The value is only returned by the API on creation and cannot be retrieved again.
 *
 * @param tokenValue - The raw token secret returned by the API.
 * @param tokenName - The display name of the created token.
 */
export function showCreatedToken(tokenValue: string, tokenName: string): void {
  note(
    `${colour.CYAN}${tokenValue}${colour.RESET}\n\n${colour.WHITE}Copy this token now.${colour.RESET} It will not be shown again.\nManage tokens: ${colour.CYAN}${CF_API_TOKENS_URL}${colour.RESET}`,
    `Token created: ${tokenName}`
  );
}
