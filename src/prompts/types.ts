/**
 * Unique symbol returned by backable prompts when the user presses Backspace
 * to go back to the previous prompt step.
 */
export const GO_BACK = Symbol("go-back");

/**
 * Wraps a type to also accept the {@linkcode GO_BACK} symbol, used by prompts
 * that allow back-navigation.
 */
export type Backable<T> = T | typeof GO_BACK;

/** Upfront token permission preset chosen before account/scope pickers. */
export type TokenPreset = "custom" | "full-access";

/** Actions available after a token template URL is generated. */
export type PostCreateAction =
  | "again"
  | "done"
  | "revoke-again"
  | "revoke-done";

/** A single selectable option used by search and select prompts. */
export interface SearchOption {
  /** When `true`, the option is visible but cannot be selected. */
  disabled?: boolean;
  /** Full scope string for search matching (e.g. `com.cloudflare.api.account.zone`). */
  fullScope?: string;
  /** Secondary label shown when the option is focused. */
  hint?: string;
  /** Primary display text. */
  label: string;
  /** Internal value returned on selection. */
  value: string;
}

/** Key event metadata from `@clack/core`. */
export interface KeypressInfo {
  ctrl?: boolean;
  name?: string;
  sequence?: string;
}

/** Lifecycle states a prompt transitions through. */
export type PromptState = "active" | "cancel" | "error" | "initial" | "submit";

/** Minimal view state shared across all prompt types. */
export interface PromptViewState {
  /** Error message displayed when `state` is `"error"`. */
  error: string;
  /** Current lifecycle state of the prompt. */
  state: PromptState;
}

/** View state for the multi-select search prompt (`AutocompletePrompt`). */
export interface SearchPromptState extends PromptViewState {
  /** Index of the currently focused option among `filteredOptions`. */
  cursor: number;
  /** Options matching the current search query. */
  filteredOptions: SearchOption[];
  /** The `value` of the option the cursor is on. */
  focusedValue: string | undefined;
  /** `true` when the user has arrow-keyed into the option list (not typing). */
  isNavigating: boolean;
  /** The full unfiltered option set. */
  options: SearchOption[];
  /** Values the user has checked so far. */
  selectedValues: string[];
  /** Current search text (without cursor). */
  userInput: string;
  /** Search text with the clack cursor indicator appended. */
  userInputWithCursor: string;
}

/** View state for the single-select prompt (`SelectPrompt`). */
export interface SelectPromptState extends PromptViewState {
  /** Index of the currently focused option. */
  cursor: number;
  /** All options in this select. */
  options: SearchOption[];
  /** The `value` of the currently selected option. */
  value: string | undefined;
}

/** View state for the text input prompt (`TextPrompt`). */
export interface TextPromptState extends PromptViewState {
  /** Current input text (without cursor). */
  userInput: string;
  /** Input text with the clack cursor indicator appended. */
  userInputWithCursor: string;
}
