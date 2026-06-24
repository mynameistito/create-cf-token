import { SelectPrompt } from "@clack/core";

import { check, exitIfNonInteractive } from "#src/prompts/guards.ts";
import { renderSelectPrompt } from "#src/prompts/render/select.ts";
import { isBackspaceKey, submitGoBack } from "#src/prompts/render/shared.ts";
import type { Backable, SearchOption } from "#src/prompts/types.ts";

/**
 * Show a single-select prompt with back-navigation.
 * Pressing Backspace returns the {@linkcode GO_BACK} symbol.
 *
 * @param message - The prompt question text.
 * @param options - Available options.
 * @returns The selected value, or {@linkcode GO_BACK}.
 */
export async function selectWithBack(
  message: string,
  options: SearchOption[]
): Promise<Backable<string>> {
  exitIfNonInteractive();
  const prompt = new SelectPrompt<SearchOption>({
    options,
    render() {
      return renderSelectPrompt(this, message, true);
    },
  });

  prompt.on("key", (char, key) => {
    if (!isBackspaceKey(char, key)) {
      return;
    }

    submitGoBack(prompt);
  });

  return check(await prompt.prompt()) as Backable<string>;
}
