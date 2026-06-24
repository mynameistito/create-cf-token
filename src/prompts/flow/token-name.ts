import { textWithBack } from "#src/prompts/primitives/text-with-back.ts";
import type { Backable } from "#src/prompts/types.ts";

/**
 * Prompt the user to enter a token name, pre-filled with a generated default.
 *
 * @param defaultName - The initial value shown in the input field.
 * @returns The entered name, or {@linkcode GO_BACK} on Backspace.
 */
export function askTokenName(defaultName: string): Promise<Backable<string>> {
  return textWithBack("Token name", defaultName);
}
