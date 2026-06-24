import { styleText } from "node:util";

import { S_BAR, symbol } from "@clack/prompts";

import { GO_BACK } from "#src/prompts/types.ts";
import type {
  KeypressInfo,
  PromptState,
  PromptViewState,
  SearchOption,
} from "#src/prompts/types.ts";

const SEARCH_SPLIT_RE = /\s+/u;

/**
 * Subsequence fuzzy-match: returns `true` if every character of `needle`
 * appears in `haystack` in order (not necessarily contiguously).
 *
 * @param haystack - The string to search within.
 * @param needle - The characters to find in order.
 */
function fuzzyIncludes(haystack: string, needle: string): boolean {
  let needleIndex = 0;

  for (const char of haystack) {
    if (char === needle[needleIndex]) {
      needleIndex += 1;
    }

    if (needleIndex === needle.length) {
      return true;
    }
  }

  return needle.length === 0;
}

/**
 * Determine whether an option matches a search query.
 *
 * The query is split on whitespace; every term must match at least one of the
 * option's fields (`label`, `hint`, `value`, `fullScope`) via substring or
 * fuzzy subsequence matching.
 *
 * @param search - The user's raw search input.
 * @param option - The option to test.
 */
export function matchesSearch(search: string, option: SearchOption): boolean {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystacks = [
    option.label,
    option.hint ?? "",
    option.value,
    option.fullScope ?? "",
  ].map((value) => value.toLowerCase());
  const terms = query.split(SEARCH_SPLIT_RE).filter(Boolean);

  return terms.every((term) =>
    haystacks.some(
      (haystack) => haystack.includes(term) || fuzzyIncludes(haystack, term)
    )
  );
}

/**
 * Build the indentation prefix for prompt body lines when clack's guide mode is active.
 *
 * @param withGuide - Whether clack's guide rail is enabled.
 * @param accent - Colour for the guide bar.
 */
export function getGuidePrefix(
  withGuide: boolean,
  accent: "cyan" | "yellow"
): string {
  if (!withGuide) {
    return "";
  }

  return `${styleText(accent, S_BAR)}  `;
}

/**
 * Render the prompt header — the state icon and question text.
 * When the guide rail is active, a leading gray bar line is prepended.
 *
 * @param prompt - Current prompt view state.
 * @param message - The question/prompt text.
 * @param withGuide - Whether to include the guide bar prefix.
 */
export function getHeaderLines(
  prompt: PromptViewState,
  message: string,
  withGuide: boolean
): string[] {
  if (!withGuide) {
    return [`${symbol(prompt.state)}  ${message}`];
  }

  return [styleText("gray", S_BAR), `${symbol(prompt.state)}  ${message}`];
}

/**
 * Append a "Backspace: go back" hint to the footer when back-navigation is enabled.
 *
 * @param footerParts - Existing footer hint strings.
 * @param allowBack - Whether to append the back hint.
 */
export function appendBackHint(
  footerParts: string[],
  allowBack: boolean
): string[] {
  if (allowBack) {
    footerParts.push(`${styleText("dim", "Backspace:")} go back`);
  }

  return footerParts;
}

/**
 * Force-submit a prompt with the {@linkcode GO_BACK} value, signalling the
 * caller to return to the previous prompt step.
 *
 * @param prompt - The prompt instance to submit.
 */
export function submitGoBack(prompt: { state: PromptState }): void {
  Reflect.set(prompt, "value", GO_BACK);
  prompt.state = "submit";
}

/**
 * Check whether a keypress event represents a backspace, accounting for
 * cross-platform terminal differences (DEL vs BS).
 *
 * @param char - The raw character emitted.
 * @param key - Normalised key metadata from clack.
 */
export function isBackspaceKey(
  char: string | undefined,
  key: KeypressInfo | undefined
): boolean {
  return (
    key?.name === "backspace" ||
    key?.sequence === "\u007F" ||
    key?.sequence === "\b" ||
    char === "\u007F" ||
    char === "\b"
  );
}
