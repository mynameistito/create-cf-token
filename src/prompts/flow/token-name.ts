import { textWithBack } from "@/prompts/primitives/text-with-back.ts";
import type { Backable } from "@/prompts/types.ts";

const defaultDeps = { textWithBack };

/**
 * Prompt the user to enter a token name, pre-filled with a generated default.
 *
 * @param defaultName - The initial value shown in the input field.
 * @returns The entered name, or {@link module:prompts/types.GO_BACK} on Backspace.
 */
export function askTokenName(
  defaultName: string,
  deps = defaultDeps
): Promise<Backable<string>> {
  return deps.textWithBack("Token name", defaultName);
}
