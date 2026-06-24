import { TextPrompt } from "@clack/core";

import { check, exitIfNonInteractive } from "#src/prompts/guards.ts";
import { isBackspaceKey, submitGoBack } from "#src/prompts/render/shared.ts";
import { renderTextPrompt } from "#src/prompts/render/text.ts";
import type { Backable } from "#src/prompts/types.ts";

/**
 * Show a text input prompt with back-navigation.
 * Pressing Backspace when the input is empty returns {@linkcode GO_BACK}.
 *
 * @param message - The prompt question text.
 * @param initialValue - Pre-filled default value.
 * @returns The entered text, or {@linkcode GO_BACK}.
 */
export async function textWithBack(
  message: string,
  initialValue: string
): Promise<Backable<string>> {
  exitIfNonInteractive();
  const prompt = new TextPrompt({
    initialValue,
    render() {
      return renderTextPrompt(this, message, this.userInput.length === 0);
    },
    validate: (value) => (value ? undefined : "Name is required"),
  });

  prompt.on("key", (char, key) => {
    if (prompt.userInput.length > 0 || !isBackspaceKey(char, key)) {
      return;
    }

    submitGoBack(prompt);
  });

  return check(await prompt.prompt()) as Backable<string>;
}
