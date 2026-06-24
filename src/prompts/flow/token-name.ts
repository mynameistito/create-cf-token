import { textWithBack } from "@/prompts/primitives/text-with-back.ts";
import type { Backable } from "@/prompts/types.ts";

const defaultDeps: { textWithBack: typeof textWithBack } = { textWithBack };

/**
 * Prompt the user to enter a token name, pre-filled with a generated default.
 *
 * Backspace on an empty input returns {@linkcode GO_BACK}.
 *
 * @param defaultName - The initial value shown in the input field.
 * @param deps - Injectable prompt primitives (defaults to production {@linkcode textWithBack}).
 * @returns The entered name, or {@linkcode GO_BACK} when the user navigates back.
 */
export function askTokenName(
  defaultName: string,
  deps: typeof defaultDeps = defaultDeps
): Promise<Backable<string>> {
  return deps.textWithBack("Token name", defaultName);
}
