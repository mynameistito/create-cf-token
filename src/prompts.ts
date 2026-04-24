/**
 * @module prompts
 *
 * Interactive CLI prompt layer for the create-cf-token tool.
 *
 * All terminal interaction is isolated here — every `@clack/prompts` import
 * lives in this file. Other modules call the exported functions to show
 * prompts and receive user input back, keeping UI concerns separated from
 * business logic.
 *
 * The module provides three custom prompt primitives with "go back" support:
 * - **searchMultiselect** — fuzzy-searchable multi-select with checkbox options
 * - **selectWithBack** — single-select radio list with back navigation
 * - **textWithBack** — free-text input with back navigation
 *
 * These backable prompts return {@linkcode Backable}&lt;T&gt;, which is either
 * the chosen value or the {@linkcode GO_BACK} symbol.
 */

import { styleText } from "node:util";
import {
  AutocompletePrompt,
  settings as clackSettings,
  SelectPrompt,
  TextPrompt,
} from "@clack/core";
import {
  cancel,
  isCancel,
  limitOptions,
  log,
  note,
  outro,
  password,
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
  select,
  spinner,
  symbol,
} from "@clack/prompts";
import colour from "#src/colour.ts";
import type { Account, PermissionGroup, ServiceGroup } from "#src/types.ts";

/** URL to the Cloudflare dashboard API tokens page, shown in prompts and errors. */
export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

/** Pre-built template URL to create the scoped auth token required by this tool.
 *  Keys are best-effort fallbacks — use {@linkcode buildAuthTemplateUrl} post-auth for accurate keys. */
export const CF_AUTH_TEMPLATE_URL = (() => {
  const keys = [
    { key: "user_details", type: "read" },
    { key: "api_tokens", type: "edit" },
    { key: "account_settings", type: "read" },
  ];
  const params = new URLSearchParams({
    permissionGroupKeys: JSON.stringify(keys),
    accountId: "*",
    zoneId: "all",
    name: "create-cf-token",
  });
  return `${CF_API_TOKENS_URL}?${params.toString()}`;
})();

/**
 * Build the auth token template URL dynamically from the live permission groups API response.
 * Looks up the real `key` values for the three required permissions: User Details:Read,
 * User API Tokens:Edit, and Account Settings:Read (needed to list accounts).
 *
 * @param perms - Permission groups fetched from `/user/tokens/permission_groups`.
 * @returns A fully-formed template URL, or `undefined` if the required keys are missing.
 */
export function buildAuthTemplateUrl(
  perms: PermissionGroup[]
): string | undefined {
  const USER_SCOPE = "com.cloudflare.api.user";
  const ACCOUNT_SCOPE = "com.cloudflare.api.account";
  const lc = (s: string) => s.toLowerCase();

  const withKey = (p: PermissionGroup) => !!p.key;

  const detailsRead = perms.find(
    (p) =>
      withKey(p) &&
      p.scopes.includes(USER_SCOPE) &&
      lc(p.name).includes("user details") &&
      lc(p.name).endsWith("read")
  );

  const tokensEdit = perms.find(
    (p) =>
      withKey(p) &&
      p.scopes.includes(USER_SCOPE) &&
      lc(p.name).includes("token") &&
      (lc(p.name).endsWith("edit") || lc(p.name).endsWith("write"))
  );

  const accountRead = perms.find(
    (p) =>
      withKey(p) &&
      p.scopes.includes(ACCOUNT_SCOPE) &&
      lc(p.name).includes("account") &&
      lc(p.name).includes("settings") &&
      lc(p.name).endsWith("read")
  );

  if (!(detailsRead?.key && tokensEdit?.key && accountRead?.key)) {
    return;
  }

  const keys = [
    { key: detailsRead.key, type: "read" },
    { key: tokensEdit.key, type: "edit" },
    { key: accountRead.key, type: "read" },
  ];
  const params = new URLSearchParams({
    permissionGroupKeys: JSON.stringify(keys),
    accountId: "*",
    zoneId: "all",
    name: "create-cf-token",
  });
  return `${CF_API_TOKENS_URL}?${params.toString()}`;
}

/**
 * Unique symbol returned by backable prompts when the user presses Backspace
 * to go back to the previous prompt step.
 */
export const GO_BACK = Symbol("go-back");

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI/OSC escape stripping requires matching control chars
const ANSI_RE = /\x1b\[[0-9;]*m|\x1b\][^\x07]*\x07/g;
const SEARCH_SPLIT_RE = /\s+/;

/** Strip all ANSI CSI and OSC escape sequences from a string, returning visible characters only. */
const strip = (s: string): string => s.replace(ANSI_RE, "");

/**
 * Wrap a URL in an OSC 8 terminal hyperlink so it is clickable in supported terminals.
 * The visible text is the URL itself; the href target is also the full URL.
 *
 * @param url - The URL to link to and display.
 */
export function hyperlinkUrl(url: string): string {
  return `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`;
}

/** Wrap a string in dim gray ANSI codes. */
const gray = (s: string): string => `\x1b[90m${s}\x1b[0m`;

/** Cursor movement actions emitted by `@clack/core` prompts. */
type CursorAction =
  | "cancel"
  | "down"
  | "enter"
  | "left"
  | "right"
  | "space"
  | "up";

/** Lifecycle states a prompt transitions through. */
type PromptState = "active" | "cancel" | "error" | "initial" | "submit";

/**
 * Wraps a type to also accept the {@linkcode GO_BACK} symbol, used by prompts
 * that allow back-navigation.
 */
type Backable<T> = T | typeof GO_BACK;

/** Actions available after a token template URL is generated. */
type PostCreateAction = "again" | "done";

/** A single selectable option used by search and select prompts. */
interface SearchOption {
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
interface KeypressInfo {
  name?: string;
  sequence?: string;
}

/** Minimal view state shared across all prompt types. */
interface PromptViewState {
  /** Error message displayed when `state` is `"error"`. */
  error: string;
  /** Current lifecycle state of the prompt. */
  state: PromptState;
}

/** View state for the multi-select search prompt (`AutocompletePrompt`). */
interface SearchPromptState extends PromptViewState {
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
interface SelectPromptState extends PromptViewState {
  /** Index of the currently focused option. */
  cursor: number;
  /** All options in this select. */
  options: SearchOption[];
  /** The `value` of the currently selected option. */
  value: string | undefined;
}

/** View state for the text input prompt (`TextPrompt`). */
interface TextPromptState extends PromptViewState {
  /** Current input text (without cursor). */
  userInput: string;
  /** Input text with the clack cursor indicator appended. */
  userInputWithCursor: string;
}

function skipEscapeAt(
  line: string,
  i: number
): { next: number; hyperlink?: boolean } | null {
  if (line[i + 1] === "[") {
    const end = line.indexOf("m", i + 2);
    if (end !== -1) {
      return { next: end + 1 };
    }
  } else if (line[i + 1] === "]") {
    const bel = line.indexOf("\x07", i + 2);
    if (bel !== -1) {
      return { next: bel + 1, hyperlink: line.slice(i + 2, bel) !== "8;;" };
    }
  }
  return null;
}

/**
 * Truncate a string to `maxWidth` visible characters, accounting for ANSI CSI and
 * OSC 8 hyperlink sequences. When truncated, any open hyperlink is closed before
 * the ellipsis so the terminal link state resets cleanly.
 *
 * @param line - The string to potentially truncate.
 * @param maxWidth - Maximum number of visible characters.
 * @returns The original or truncated string.
 */
function truncateLine(line: string, maxWidth: number): string {
  let visibleCount = 0;
  let i = 0;
  let inHyperlink = false;

  while (i < line.length) {
    if (line[i] === "\x1b") {
      const skip = skipEscapeAt(line, i);
      if (skip) {
        if (skip.hyperlink !== undefined) {
          inHyperlink = skip.hyperlink;
        }
        i = skip.next;
        continue;
      }
    }
    visibleCount++;
    if (visibleCount >= maxWidth) {
      const closeLink = inHyperlink ? "\x1b]8;;\x07" : "";
      return `${line.slice(0, i)}…${closeLink}${colour.RESET}`;
    }
    i++;
  }
  return line;
}

/**
 * Find the character index at which a line should be split for wrapping.
 * Prefers splitting at a space boundary; falls back to a hard break.
 *
 * @param text - The line to analyse.
 * @param maxWidth - Maximum visible characters per line.
 * @returns The split index, or `undefined` if the line fits.
 */
function findSplitIndex(
  text: string,
  maxWidth: number
): { splitIdx: number } | undefined {
  let visibleCount = 0;
  let lastSpaceIdx = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\x1b") {
      const end = text.indexOf("m", i);
      if (end !== -1) {
        i = end;
        continue;
      }
    }
    visibleCount++;
    if (text[i] === " ") {
      lastSpaceIdx = i;
    }
    if (visibleCount > maxWidth) {
      return { splitIdx: lastSpaceIdx > 0 ? lastSpaceIdx : i };
    }
  }
  return;
}

/**
 * Word-wrap a single line into multiple lines of at most `maxWidth` visible characters.
 * ANSI escape sequences are not counted toward the width.
 *
 * @param line - The line to wrap.
 * @param maxWidth - Maximum visible characters per wrapped line.
 * @returns Array of wrapped lines.
 */
function wrapLine(line: string, maxWidth: number): string[] {
  if (maxWidth < 1) {
    return [line];
  }
  const result: string[] = [];
  let remaining = line;

  while (strip(remaining).length > maxWidth) {
    const found = findSplitIndex(remaining, maxWidth);
    if (!found) {
      break;
    }
    result.push(remaining.slice(0, found.splitIdx));
    const skip = remaining[found.splitIdx] === " " ? 1 : 0;
    remaining = remaining.slice(found.splitIdx + skip);
  }

  result.push(remaining);
  return result;
}

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
      needleIndex++;
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
function matchesSearch(search: string, option: SearchOption): boolean {
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
function getGuidePrefix(withGuide: boolean, accent: "cyan" | "yellow"): string {
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
function getHeaderLines(
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
function appendBackHint(footerParts: string[], allowBack: boolean): string[] {
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
function submitGoBack(prompt: { state: PromptState }): void {
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
function isBackspaceKey(
  char: string | undefined,
  key: KeypressInfo | undefined
): boolean {
  return (
    key?.name === "backspace" ||
    key?.sequence === "\x7F" ||
    key?.sequence === "\b" ||
    char === "\x7F" ||
    char === "\b"
  );
}

/**
 * Render a single option row in the multi-select search prompt.
 *
 * @param option - The option to render.
 * @param active - Whether this option is currently focused.
 * @param selectedValues - Values currently checked by the user.
 * @param focusedValue - The value of the focused option (for hint display).
 */
function renderSearchOption(
  option: SearchOption,
  active: boolean,
  selectedValues: string[],
  focusedValue: string | undefined
): string {
  const selected = selectedValues.includes(option.value);
  const hint =
    option.hint && option.value === focusedValue
      ? styleText("dim", ` (${option.hint})`)
      : "";

  if (option.disabled) {
    return `${styleText("gray", S_CHECKBOX_INACTIVE)} ${styleText(["strikethrough", "gray"], option.label)}`;
  }

  const checkbox = selected
    ? styleText("green", S_CHECKBOX_SELECTED)
    : styleText("dim", S_CHECKBOX_INACTIVE);

  if (active) {
    return `${checkbox} ${option.label}${hint}`;
  }

  return `${checkbox} ${styleText("dim", option.label)}`;
}

/**
 * Render a single option row in the single-select prompt.
 *
 * @param option - The option to render.
 * @param active - Whether this option is currently focused.
 */
function renderSelectOption(option: SearchOption, active: boolean): string {
  if (option.disabled) {
    return `${styleText("gray", S_RADIO_INACTIVE)} ${styleText(["strikethrough", "gray"], option.label)}`;
  }

  const radio = active
    ? styleText("cyan", S_RADIO_ACTIVE)
    : styleText("dim", S_RADIO_INACTIVE);
  const label = active ? option.label : styleText("dim", option.label);
  const hint =
    active && option.hint ? styleText("dim", ` (${option.hint})`) : "";

  return `${radio} ${label}${hint}`;
}

/**
 * Build a "N matches" annotation for the search prompt body, or an empty
 * string when no filter is active.
 *
 * @param prompt - Current search prompt state.
 */
function getSearchMatchCount(prompt: SearchPromptState): string {
  if (prompt.filteredOptions.length === prompt.options.length) {
    return "";
  }

  return styleText(
    "dim",
    ` (${prompt.filteredOptions.length} match${prompt.filteredOptions.length === 1 ? "" : "es"})`
  );
}

/**
 * Render the body lines for the search prompt: the search input field,
 * "no matches" warning, and validation errors.
 *
 * @param prompt - Current search prompt state.
 * @param guidePrefix - Indentation prefix for guide mode.
 */
function getSearchBodyLines(
  prompt: SearchPromptState,
  guidePrefix: string
): string[] {
  const searchValue = prompt.isNavigating
    ? styleText("dim", prompt.userInput)
    : prompt.userInputWithCursor;
  const bodyLines = [
    `${guidePrefix}${styleText("dim", "Search:")} ${searchValue}${getSearchMatchCount(prompt)}`,
  ];

  if (prompt.filteredOptions.length === 0 && prompt.userInput) {
    bodyLines.push(`${guidePrefix}${styleText("yellow", "No matches found")}`);
  }

  if (prompt.state === "error") {
    bodyLines.push(`${guidePrefix}${styleText("yellow", prompt.error)}`);
  }

  return bodyLines;
}

/**
 * Render the keyboard hints footer for the search prompt.
 *
 * @param prompt - Current search prompt state.
 * @param guidePrefix - Indentation prefix.
 * @param accent - Colour accent for the guide bar.
 * @param allowBack - Whether to show the "Backspace: go back" hint.
 * @param withGuide - Whether to render the closing guide bar end.
 */
function getSearchFooterLines(
  prompt: SearchPromptState,
  guidePrefix: string,
  accent: "cyan" | "yellow",
  allowBack: boolean,
  withGuide: boolean
): string[] {
  const selectHint = prompt.isNavigating ? "Space/Tab/→:" : "Tab/→:";
  const footerParts = appendBackHint(
    [
      `${styleText("dim", "↑/↓")} navigate`,
      `${styleText("dim", selectHint)} select`,
      `${styleText("dim", "←:")} deselect`,
      `${styleText("dim", "Enter:")} confirm`,
      `${styleText("dim", "Type:")} search`,
    ],
    allowBack
  );
  const footerLines = [`${guidePrefix}${footerParts.join(" • ")}`];

  if (withGuide) {
    footerLines.push(styleText(accent, S_BAR_END));
  }

  return footerLines;
}

/**
 * Render the scrollable option list for the search prompt, applying
 * cursor-based windowing via `limitOptions`.
 *
 * @param prompt - Current search prompt state.
 * @param guidePrefix - Indentation prefix.
 * @param rowPadding - Number of terminal rows to reserve for header + footer.
 */
function getSearchOptionsLines(
  prompt: SearchPromptState,
  guidePrefix: string,
  rowPadding: number
): string[] {
  if (prompt.filteredOptions.length === 0) {
    return [];
  }

  return limitOptions({
    cursor: prompt.cursor,
    options: prompt.filteredOptions,
    rowPadding,
    style: (option, active) =>
      renderSearchOption(
        option,
        active,
        prompt.selectedValues,
        prompt.focusedValue
      ),
  }).map((line) => `${guidePrefix}${line}`);
}

/**
 * Full-frame render for the multi-select search prompt.
 * Delegates to header/body/options/footer sub-renderers.
 *
 * @param prompt - Current search prompt state.
 * @param message - The prompt question text.
 * @param allowBack - Whether back-navigation is enabled.
 */
function renderSearchPrompt(
  prompt: SearchPromptState,
  message: string,
  allowBack: boolean
): string {
  const withGuide = clackSettings.withGuide;
  const accent = prompt.state === "error" ? "yellow" : "cyan";
  const guidePrefix = getGuidePrefix(withGuide, accent);
  const headerLines = getHeaderLines(prompt, message, withGuide);

  if (prompt.state === "submit") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText("dim", `${prompt.selectedValues.length} items selected`)}`;
  }

  if (prompt.state === "cancel") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText(["strikethrough", "dim"], prompt.userInput)}`;
  }

  const bodyLines = getSearchBodyLines(prompt, guidePrefix);
  const footerLines = getSearchFooterLines(
    prompt,
    guidePrefix,
    accent,
    allowBack,
    withGuide
  );
  const optionsLines = getSearchOptionsLines(
    prompt,
    guidePrefix,
    headerLines.length + bodyLines.length + footerLines.length
  );

  return [...headerLines, ...bodyLines, ...optionsLines, ...footerLines].join(
    "\n"
  );
}

/**
 * Look up the display label of the currently selected option in a select prompt.
 *
 * @param prompt - Current select prompt state.
 */
function getSelectedOptionLabel(prompt: SelectPromptState): string {
  const selectedOption = prompt.options.find(
    (option) => option.value === prompt.value
  );

  return selectedOption?.label ?? "";
}

/**
 * Render the body lines for the single-select prompt (only shown on validation error).
 *
 * @param prompt - Current select prompt state.
 * @param guidePrefix - Indentation prefix.
 */
function getSelectBodyLines(
  prompt: SelectPromptState,
  guidePrefix: string
): string[] {
  if (prompt.state !== "error") {
    return [];
  }

  return [`${guidePrefix}${styleText("yellow", prompt.error)}`];
}

/**
 * Render the keyboard hints footer for the single-select prompt.
 *
 * @param guidePrefix - Indentation prefix.
 * @param accent - Colour accent.
 * @param allowBack - Whether to show the back-navigation hint.
 * @param withGuide - Whether to render the closing guide bar end.
 */
function getSelectFooterLines(
  guidePrefix: string,
  accent: "cyan" | "yellow",
  allowBack: boolean,
  withGuide: boolean
): string[] {
  const footerParts = appendBackHint(
    [
      `${styleText("dim", "↑/↓")} navigate`,
      `${styleText("dim", "Enter:")} confirm`,
    ],
    allowBack
  );
  const footerLines = [`${guidePrefix}${footerParts.join(" • ")}`];

  if (withGuide) {
    footerLines.push(styleText(accent, S_BAR_END));
  }

  return footerLines;
}

/**
 * Render the scrollable option list for the single-select prompt.
 *
 * @param prompt - Current select prompt state.
 * @param guidePrefix - Indentation prefix.
 * @param rowPadding - Number of rows reserved for header + footer.
 */
function getSelectOptionsLines(
  prompt: SelectPromptState,
  guidePrefix: string,
  rowPadding: number
): string[] {
  return limitOptions({
    cursor: prompt.cursor,
    options: prompt.options,
    rowPadding,
    style: renderSelectOption,
  }).map((line) => `${guidePrefix}${line}`);
}

/**
 * Full-frame render for the single-select prompt.
 *
 * @param prompt - Current select prompt state.
 * @param message - The prompt question text.
 * @param allowBack - Whether back-navigation is enabled.
 */
function renderSelectPrompt(
  prompt: SelectPromptState,
  message: string,
  allowBack: boolean
): string {
  const withGuide = clackSettings.withGuide;
  const accent = prompt.state === "error" ? "yellow" : "cyan";
  const guidePrefix = getGuidePrefix(withGuide, accent);
  const headerLines = getHeaderLines(prompt, message, withGuide);
  const selectedLabel = getSelectedOptionLabel(prompt);

  if (prompt.state === "submit") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText("dim", selectedLabel)}`;
  }

  if (prompt.state === "cancel") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText(["strikethrough", "dim"], selectedLabel)}`;
  }

  const bodyLines = getSelectBodyLines(prompt, guidePrefix);
  const footerLines = getSelectFooterLines(
    guidePrefix,
    accent,
    allowBack,
    withGuide
  );
  const optionsLines = getSelectOptionsLines(
    prompt,
    guidePrefix,
    headerLines.length + bodyLines.length + footerLines.length
  );

  return [...headerLines, ...bodyLines, ...optionsLines, ...footerLines].join(
    "\n"
  );
}

/**
 * Render the body lines for the text input prompt: the input field and
 * validation error.
 *
 * @param prompt - Current text prompt state.
 * @param guidePrefix - Indentation prefix.
 */
function getTextBodyLines(
  prompt: TextPromptState,
  guidePrefix: string
): string[] {
  const bodyLines = [`${guidePrefix}${prompt.userInputWithCursor}`];

  if (prompt.state === "error") {
    bodyLines.push(`${guidePrefix}${styleText("yellow", prompt.error)}`);
  }

  return bodyLines;
}

/**
 * Render the keyboard hints footer for the text input prompt.
 *
 * @param guidePrefix - Indentation prefix.
 * @param accent - Colour accent.
 * @param allowBack - Whether to show the back-navigation hint.
 * @param withGuide - Whether to render the closing guide bar end.
 */
function getTextFooterLines(
  guidePrefix: string,
  accent: "cyan" | "yellow",
  allowBack: boolean,
  withGuide: boolean
): string[] {
  const footerParts = appendBackHint(
    [`${styleText("dim", "Enter:")} confirm`],
    allowBack
  );
  const footerLines = [`${guidePrefix}${footerParts.join(" • ")}`];

  if (withGuide) {
    footerLines.push(styleText(accent, S_BAR_END));
  }

  return footerLines;
}

/**
 * Full-frame render for the text input prompt.
 *
 * @param prompt - Current text prompt state.
 * @param message - The prompt question text.
 * @param allowBack - Whether back-navigation is enabled.
 */
function renderTextPrompt(
  prompt: TextPromptState,
  message: string,
  allowBack: boolean
): string {
  const withGuide = clackSettings.withGuide;
  const accent = prompt.state === "error" ? "yellow" : "cyan";
  const guidePrefix = getGuidePrefix(withGuide, accent);
  const headerLines = getHeaderLines(prompt, message, withGuide);

  if (prompt.state === "submit") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText("dim", prompt.userInput)}`;
  }

  if (prompt.state === "cancel") {
    return `${headerLines.join("\n")}\n${guidePrefix}${styleText(["strikethrough", "dim"], prompt.userInput)}`;
  }

  const bodyLines = getTextBodyLines(prompt, guidePrefix);
  const footerLines = getTextFooterLines(
    guidePrefix,
    accent,
    allowBack,
    withGuide
  );

  return [...headerLines, ...bodyLines, ...footerLines].join("\n");
}

/**
 * Render a boxed note directly to stdout with word-wrapping and terminal-width awareness.
 * URLs inside the note are truncated rather than wrapped.
 *
 * @param message - The note body (may contain ANSI codes and newlines).
 * @param title - The note title displayed in the top border.
 */
export function printNote(message: string, title: string): void {
  const cols =
    process.stdout.columns ||
    process.stderr.columns ||
    Number(process.env.COLUMNS) ||
    80;
  const maxContentWidth = Math.max(cols - 6, 20);

  const rawLines = `\n${message}\n`.split("\n");
  const lines = rawLines.flatMap((l) => {
    const visible = strip(l);
    if (visible.length <= maxContentWidth) {
      return [l];
    }
    if (visible.includes("https://")) {
      return [truncateLine(l, maxContentWidth)];
    }
    return wrapLine(l, maxContentWidth);
  });

  const len = maxContentWidth;

  const dashes = Math.max(len - strip(title).length + 1, 0);
  const top = `${colour.GREEN}◇${colour.RESET}  ${title} ${gray(`${"─".repeat(dashes)}╮`)}`;
  const rows = lines.map(
    (l) =>
      `${gray("│")}  ${l}${" ".repeat(Math.max(len - strip(l).length, 0))}  ${gray("│")}`
  );
  const bottom = gray(`╰─${"─".repeat(len + 3)}╯`);
  process.stdout.write(`${[top, ...rows, bottom].join("\n")}\n`);
}

/**
 * Guard against clack cancellation. If the user pressed Ctrl+C or Escape,
 * print a cancellation message and exit the process.
 *
 * @typeParam T - The expected value type.
 * @param value - The raw result from a clack prompt.
 * @returns The unwrapped value if not cancelled.
 */
function check<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

/**
 * Prompt the user for their scoped Cloudflare API token.
 *
 * Checks `CF_API_TOKEN` environment variable first; if unset, shows an
 * interactive password prompt. Exits the process on cancellation.
 *
 * The token needs at minimum: User Details:Read, User API Tokens:Edit, Account Settings:Read.
 *
 * @returns The collected API token.
 */
function isPlaceholderToken(value: string): boolean {
  return value.startsWith("your_") || value.includes(" ");
}

export async function askCredentials(): Promise<{ apiKey: string }> {
  const envToken = process.env.CF_API_TOKEN;
  const apiKey =
    (envToken && !isPlaceholderToken(envToken) ? envToken : undefined) ??
    check(
      await password({
        message: `${colour.WHITE}Your Cloudflare API Token:${colour.RESET}`,
        validate: (v) => (v ? undefined : "API token is required"),
      })
    );

  return { apiKey };
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
  let prompt!: AutocompletePrompt<SearchOption>;

  prompt = new AutocompletePrompt<SearchOption>({
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

  prompt.on("cursor", (action?: CursorAction) => {
    const focusedValue = prompt.focusedValue;

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

/**
 * Show a single-select prompt with back-navigation.
 * Pressing Backspace returns the {@linkcode GO_BACK} symbol.
 *
 * @param message - The prompt question text.
 * @param options - Available options.
 * @returns The selected value, or {@linkcode GO_BACK}.
 */
async function selectWithBack(
  message: string,
  options: SearchOption[]
): Promise<Backable<string>> {
  let prompt!: SelectPrompt<SearchOption>;

  prompt = new SelectPrompt<SearchOption>({
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

/**
 * Show a text input prompt with back-navigation.
 * Pressing Backspace when the input is empty returns {@linkcode GO_BACK}.
 *
 * @param message - The prompt question text.
 * @param initialValue - Pre-filled default value.
 * @returns The entered text, or {@linkcode GO_BACK}.
 */
async function textWithBack(
  message: string,
  initialValue: string
): Promise<Backable<string>> {
  let prompt!: TextPrompt;

  prompt = new TextPrompt({
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

/**
 * Convert an array of service groups into selectable search options.
 * Each option's hint includes the available access levels and scope labels.
 *
 * @param scopes - Service groups to present as options.
 * @returns Options suitable for {@linkcode searchMultiselect}.
 */
function buildScopeOptions(scopes: ServiceGroup[]): SearchOption[] {
  return scopes.map((service) => {
    const levels = service.perms.map(
      (permissionGroup) =>
        permissionGroup.name.replace(service.name, "").trim() ||
        permissionGroup.name
    );
    const scopeLabels = service.scopes.map((scope) => scope.split(".").pop());
    const fullScope = service.scopes.join(" ");

    return {
      fullScope,
      hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
      label: service.name,
      value: service.name,
    };
  });
}

/**
 * For each selected scope, resolve its concrete permission groups.
 *
 * When a service has both read and write permissions, a sub-prompt asks the
 * user to choose the access level. Other permissions (e.g. edit) are included
 * automatically.
 *
 * @param scopes - All available service groups.
 * @param selected - Names of scopes the user checked in the multi-select.
 * @returns The resolved permission groups, or {@linkcode GO_BACK} if the user navigated back.
 */
async function buildPermissionsForSelection(
  scopes: ServiceGroup[],
  selected: string[]
): Promise<Backable<PermissionGroup[]>> {
  const chosen: PermissionGroup[] = [];

  for (const scopeName of selected) {
    const service = scopes.find((scope) => scope.name === scopeName);

    if (!service) {
      continue;
    }

    chosen.push(...service.otherPerms);

    if (!(service.readPerm && service.writePerm)) {
      if (service.readPerm) {
        chosen.push(service.readPerm);
      }
      if (service.writePerm) {
        chosen.push(service.writePerm);
      }
      continue;
    }

    const level = await selectWithBack(`${service.name} — access level`, [
      { value: "read", label: "Read only" },
      { value: "write", label: "Read + Write" },
    ]);

    if (level === GO_BACK) {
      return GO_BACK;
    }

    chosen.push(service.readPerm);
    if (level === "write") {
      chosen.push(service.writePerm);
    }
  }

  return chosen;
}

/**
 * Prompt the user to select one or more Cloudflare accounts from the given list.
 *
 * @param accounts - Accounts fetched from the Cloudflare API.
 * @returns The accounts the user selected.
 */
export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const options = accounts.map((account) => ({
    hint: account.id,
    label: account.name,
    value: account.id,
  }));
  const ids = await searchMultiselect("Select accounts", options, false);
  return accounts.filter((account) => ids.includes(account.id));
}

/**
 * Prompt the user to select permission scopes and resolve them to concrete
 * permission groups. Supports back-navigation: if the user presses Backspace
 * during the access-level sub-prompt, they return to the scope selection.
 *
 * @param scopes - All available service groups.
 * @returns The chosen permission groups, or {@linkcode GO_BACK}.
 */
export async function selectScopes(
  scopes: ServiceGroup[]
): Promise<Backable<PermissionGroup[]>> {
  while (true) {
    const selected = await searchMultiselect(
      "Select scopes",
      buildScopeOptions(scopes),
      true
    );

    if (selected === GO_BACK) {
      return GO_BACK;
    }

    const chosen = await buildPermissionsForSelection(scopes, selected);
    if (chosen === GO_BACK) {
      continue;
    }

    return chosen;
  }
}

/**
 * Prompt the user to enter a token name, pre-filled with a generated default.
 *
 * @param defaultName - The initial value shown in the input field.
 * @returns The entered name, or {@linkcode GO_BACK} on Backspace.
 */
export function askTokenName(defaultName: string): Promise<Backable<string>> {
  return textWithBack("Token name", defaultName);
}

/**
 * Ask the user what to do after a token has been created.
 *
 * @returns `"done"` or `"again"`.
 */
export async function askPostCreateAction(): Promise<PostCreateAction> {
  return check(
    await select({
      message: "What would you like to do next?",
      options: [
        { value: "done", label: "Done" },
        { value: "again", label: "Create another token" },
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

/**
 * Print a clack cancellation message and exit the process.
 *
 * @param message - The cancellation reason to display.
 */
export function cancelPrompt(message: string): void {
  cancel(message);
}

/** Thin wrapper around `@clack/prompts` log methods to avoid importing clack outside this module. */
export const logMessage = {
  info: (message: string): void => log.info(message),
  warn: (message: string): void => log.warn(message),
  error: (message: string): void => log.error(message),
};

/**
 * Display a clack note box with a title.
 *
 * @param message - The note body.
 * @param title - The note heading.
 */
export function showNote(message: string, title: string): void {
  note(message, title);
}

/**
 * Display a clack outro message signalling completion.
 *
 * @param message - The outro text.
 */
export function finishOutro(message: string): void {
  outro(message);
}

/**
 * Create a new clack spinner instance for showing loading states.
 *
 * @returns A clack spinner with `start()`, `stop()`, and `message()` methods.
 */
export function createSpinner(): ReturnType<typeof spinner> {
  return spinner();
}
