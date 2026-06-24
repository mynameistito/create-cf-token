import { styleText } from "node:util";

import {
  settings as clackSettings,
  limitOptions,
  S_BAR_END,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
} from "@clack/prompts";

import {
  appendBackHint,
  getGuidePrefix,
  getHeaderLines,
} from "@/prompts/render/shared.ts";
import type { SearchOption, SelectPromptState } from "@/prompts/types.ts";

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

function getSelectedOptionLabel(prompt: SelectPromptState): string {
  const selectedOption = prompt.options.find(
    (option) => option.value === prompt.value
  );

  return selectedOption?.label ?? "";
}

function getSelectBodyLines(
  prompt: SelectPromptState,
  guidePrefix: string
): string[] {
  if (prompt.state !== "error") {
    return [];
  }

  return [`${guidePrefix}${styleText("yellow", prompt.error)}`];
}

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

export function renderSelectPrompt(
  prompt: SelectPromptState,
  message: string,
  allowBack: boolean
): string {
  const { withGuide } = clackSettings;
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
