import { styleText } from "node:util";

import { settings as clackSettings, S_BAR_END } from "@clack/prompts";

import {
  appendBackHint,
  getGuidePrefix,
  getHeaderLines,
} from "#src/prompts/render/shared.ts";
import type { TextPromptState } from "#src/prompts/types.ts";

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

export function renderTextPrompt(
  prompt: TextPromptState,
  message: string,
  allowBack: boolean
): string {
  const { withGuide } = clackSettings;
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
