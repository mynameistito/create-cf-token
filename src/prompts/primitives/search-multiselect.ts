import { AutocompletePrompt } from "@clack/core";

import { check, exitIfNonInteractive } from "@/prompts/guards.ts";
import { renderSearchPrompt } from "@/prompts/render/search.ts";
import {
  isBackspaceKey,
  matchesSearch,
  submitGoBack,
} from "@/prompts/render/shared.ts";
import type {
  Backable,
  KeypressInfo,
  PromptState,
  SearchOption,
} from "@/prompts/types.ts";

/** Cursor movement actions emitted by `@clack/core` prompts. */
type CursorAction =
  | "cancel"
  | "down"
  | "enter"
  | "left"
  | "right"
  | "space"
  | "up";

interface SearchMultiselectPrompt {
  _clearUserInput: () => void;
  cursor: number;
  deselectAll: () => void;
  error: string;
  filteredOptions: SearchOption[];
  focusedValue: string | undefined;
  isNavigating: boolean;
  on: (
    event: "cursor" | "key",
    handler:
      | ((action?: CursorAction) => void)
      | ((char: string, key: KeypressInfo | undefined) => void)
  ) => void;
  options: SearchOption[];
  prompt: () => Promise<unknown>;
  selectedValues: string[];
  state: PromptState;
  toggleSelected: (value: string) => void;
  userInput: string;
  userInputWithCursor: string;
}

type SearchMultiselectPromptConstructor = new (config: {
  filter: (search: string, option: SearchOption) => boolean;
  multiple: boolean;
  options: SearchOption[];
  render: (this: SearchMultiselectPrompt) => string;
  validate: () => string | undefined;
}) => SearchMultiselectPrompt;

export interface SearchMultiselect {
  (
    message: string,
    options: SearchOption[],
    allowBack: true
  ): Promise<Backable<string[]>>;
  (
    message: string,
    options: SearchOption[],
    allowBack: false
  ): Promise<string[]>;
}

/**
 * Whether a keypress should toggle select-all in a search multiselect.
 * Ctrl+A always toggles; bare `a` toggles only after the user navigated the option list.
 *
 * Bare `a` cannot use `prompt.isNavigating` — AutocompletePrompt clears that flag
 * in its own key handler before custom listeners run.
 */
export function shouldToggleSelectAll(
  key: KeypressInfo | undefined,
  navigatingList: boolean
): boolean {
  if (key?.ctrl === true && key?.name === "a") {
    return true;
  }

  return key?.name === "a" && !key?.ctrl && navigatingList;
}

/**
 * Toggle between selecting all enabled options and deselecting all.
 *
 * @param prompt - The active search multiselect prompt.
 */
function toggleSelectAll(prompt: SearchMultiselectPrompt): void {
  const enabled = prompt.filteredOptions.filter((option) => !option.disabled);
  const selected = new Set(prompt.selectedValues);
  const allSelected =
    enabled.length > 0 && enabled.every((option) => selected.has(option.value));

  for (const option of enabled) {
    const isSelected = selected.has(option.value);
    if (allSelected ? isSelected : !isSelected) {
      prompt.toggleSelected(option.value);
    }
  }
}

/**
 * Show a fuzzy-searchable multi-select prompt with optional back-navigation.
 *
 * When `allowBack` is `true`, pressing Backspace with an empty search input
 * returns the {@linkcode GO_BACK} symbol instead of a value array.
 *
 * Overloaded: the return type narrows to `string[]` when `allowBack` is `false`.
 *
 * @param message - The prompt question text.
 * @param options - Available options to select from.
 * @param allowBack - Whether to enable back-navigation via Backspace.
 */
function createSearchMultiselect(
  Prompt: SearchMultiselectPromptConstructor = AutocompletePrompt as unknown as SearchMultiselectPromptConstructor
): SearchMultiselect {
  async function searchMultiselect(
    message: string,
    options: SearchOption[],
    allowBack: true
  ): Promise<Backable<string[]>>;
  async function searchMultiselect(
    message: string,
    options: SearchOption[],
    allowBack: false
  ): Promise<string[]>;
  async function searchMultiselect(
    message: string,
    options: SearchOption[],
    allowBack: boolean
  ): Promise<Backable<string[]>> {
    exitIfNonInteractive();
    const prompt = new Prompt({
      filter: matchesSearch,
      multiple: true,
      options,
      render() {
        return renderSearchPrompt(this, message, allowBack);
      },
      validate: () => {
        if (prompt.selectedValues.length === 0) {
          return "Please select at least one item";
        }
      },
    });

    let navigatingList = false;

    prompt.on("cursor", (action?: CursorAction) => {
      if (
        action === "up" ||
        action === "down" ||
        action === "right" ||
        action === "left"
      ) {
        navigatingList = true;
      }

      const { focusedValue } = prompt;

      if (!action || focusedValue === undefined) {
        return;
      }

      if (action === "right" && !prompt.selectedValues.includes(focusedValue)) {
        prompt.toggleSelected(focusedValue);
        prompt.isNavigating = true;
        return;
      }

      if (action === "left" && prompt.selectedValues.includes(focusedValue)) {
        prompt.toggleSelected(focusedValue);
        prompt.isNavigating = true;
        return;
      }

      if (action === "enter" && prompt.selectedValues.length === 0) {
        prompt.toggleSelected(focusedValue);
      }
    });

    prompt.on("key", (char, key) => {
      if (shouldToggleSelectAll(key, navigatingList)) {
        if (key?.name === "a" && !key?.ctrl) {
          prompt._clearUserInput();
        }
        toggleSelectAll(prompt);
        navigatingList = false;
        return;
      }

      if (
        char &&
        char.length === 1 &&
        !key?.ctrl &&
        key?.name !== "backspace" &&
        key?.name !== "return" &&
        key?.name !== "tab"
      ) {
        navigatingList = false;
      }

      if (
        !allowBack ||
        prompt.userInput.length > 0 ||
        !isBackspaceKey(char, key)
      ) {
        return;
      }

      submitGoBack(prompt);
    });

    return check(await prompt.prompt()) as Backable<string[]>;
  }

  return searchMultiselect;
}

const searchMultiselect: SearchMultiselect = createSearchMultiselect();

export { createSearchMultiselect, searchMultiselect };
