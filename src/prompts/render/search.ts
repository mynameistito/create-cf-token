import { styleText } from "node:util";

import {
  limitOptions,
  S_BAR_END,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  settings as clackSettings,
} from "@clack/prompts";

import {
  appendBackHint,
  getGuidePrefix,
  getHeaderLines,
} from "@/prompts/render/shared.ts";
import type { SearchOption, SearchPromptState } from "@/prompts/types.ts";

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

function getSearchMatchCount(prompt: SearchPromptState): string {
  if (prompt.filteredOptions.length === prompt.options.length) {
    return "";
  }

  return styleText(
    "dim",
    ` (${prompt.filteredOptions.length} match${prompt.filteredOptions.length === 1 ? "" : "es"})`
  );
}

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
      `${styleText("dim", "Ctrl+A/a:")} all`,
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

export function renderSearchPrompt(
  prompt: SearchPromptState,
  message: string,
  allowBack: boolean
): string {
  const { withGuide } = clackSettings;
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
