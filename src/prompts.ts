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
  text,
} from "@clack/prompts";
import colour from "./colour.ts";
import type {
  Account,
  CreatedToken,
  PermissionGroup,
  ServiceGroup,
} from "./types.ts";

export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";
export const GO_BACK = Symbol("go-back");

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching control chars
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const SEARCH_SPLIT_RE = /\s+/;

const strip = (s: string): string => s.replace(ANSI_RE, "");
const gray = (s: string): string => `\x1b[90m${s}\x1b[0m`;

type CursorAction =
  | "cancel"
  | "down"
  | "enter"
  | "left"
  | "right"
  | "space"
  | "up";

type PromptState = "active" | "cancel" | "error" | "initial" | "submit";
type Backable<T> = T | typeof GO_BACK;
type PostCreateAction = "again" | "done" | "revoke-again" | "revoke-done";

interface SearchOption {
  disabled?: boolean;
  hint?: string;
  label: string;
  value: string;
}

interface KeypressInfo {
  name?: string;
  sequence?: string;
}

interface PromptViewState {
  error: string;
  state: PromptState;
}

interface SearchPromptState extends PromptViewState {
  cursor: number;
  filteredOptions: SearchOption[];
  focusedValue: string | undefined;
  isNavigating: boolean;
  options: SearchOption[];
  selectedValues: string[];
  userInput: string;
  userInputWithCursor: string;
}

interface SelectPromptState extends PromptViewState {
  cursor: number;
  options: SearchOption[];
  value: string | undefined;
}

interface TextPromptState extends PromptViewState {
  userInput: string;
  userInputWithCursor: string;
}

function truncateLine(line: string, maxWidth: number): string {
  let visibleCount = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\x1b") {
      const end = line.indexOf("m", i);
      if (end !== -1) {
        i = end;
        continue;
      }
    }
    visibleCount++;
    if (visibleCount >= maxWidth) {
      return `${line.slice(0, i)}…${colour.RESET}`;
    }
  }
  return line;
}

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
  return undefined;
}

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

function matchesSearch(search: string, option: SearchOption): boolean {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystacks = [option.label, option.hint ?? "", option.value].map(
    (value) => value.toLowerCase()
  );
  const terms = query.split(SEARCH_SPLIT_RE).filter(Boolean);

  return terms.every((term) =>
    haystacks.some(
      (haystack) => haystack.includes(term) || fuzzyIncludes(haystack, term)
    )
  );
}

function getGuidePrefix(withGuide: boolean, accent: "cyan" | "yellow"): string {
  if (!withGuide) {
    return "";
  }

  return `${styleText(accent, S_BAR)}  `;
}

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

function appendBackHint(footerParts: string[], allowBack: boolean): string[] {
  if (allowBack) {
    footerParts.push(`${styleText("dim", "Backspace:")} go back`);
  }

  return footerParts;
}

function submitGoBack(prompt: { state: PromptState }): void {
  Reflect.set(prompt, "value", GO_BACK);
  prompt.state = "submit";
}

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

function check<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

export async function askCredentials(): Promise<{
  email: string;
  apiKey: string;
}> {
  const email =
    process.env.CF_EMAIL ||
    check(
      await text({
        message: `${colour.WHITE}Your Cloudflare account Email:${colour.RESET}`,
        validate: (v) => (v ? undefined : "Email is required"),
      })
    );

  const apiKey =
    process.env.CF_API_TOKEN ||
    check(
      await password({
        message: `${colour.WHITE}Your Cloudflare Global API Key:${colour.RESET}`,
        validate: (v) => (v ? undefined : "API key is required"),
      })
    );

  return { email, apiKey };
}

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

async function textWithBack(
  message: string,
  initialValue: string
): Promise<Backable<string>> {
  let prompt!: TextPrompt;

  prompt = new TextPrompt({
    initialValue,
    render() {
      return renderTextPrompt(this, message, true);
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

function buildScopeOptions(scopes: ServiceGroup[]): SearchOption[] {
  return scopes.map((service) => {
    const levels = service.perms.map(
      (permissionGroup) =>
        permissionGroup.name.replace(service.name, "").trim() ||
        permissionGroup.name
    );
    const scopeLabels = service.scopes.map((scope) => scope.split(".").pop());

    return {
      hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
      label: service.name,
      value: service.name,
    };
  });
}

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

export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const options = accounts.map((account) => ({
    hint: account.id,
    label: account.name,
    value: account.id,
  }));
  const ids = await searchMultiselect("Select accounts", options, false);

  return accounts.filter((account) => ids.includes(account.id));
}

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

export function askTokenName(defaultName: string): Promise<Backable<string>> {
  return textWithBack("Token name", defaultName);
}

export async function askDeleteCreatedTokens(
  createdTokens: CreatedToken[]
): Promise<CreatedToken[]> {
  if (createdTokens.length === 0) {
    return [];
  }

  const shouldDelete = check(
    await select({
      message:
        createdTokens.length === 1
          ? "Delete the token you created before exiting?"
          : "Delete any tokens created in this session before exiting?",
      options: [
        { value: "no", label: "No, keep them" },
        { value: "yes", label: "Yes, choose token(s)" },
      ],
    })
  );

  if (shouldDelete !== "yes") {
    return [];
  }

  if (createdTokens.length === 1) {
    return createdTokens;
  }

  const selectedIds = await searchMultiselect(
    "Select created tokens to delete",
    createdTokens.map((token) => ({
      hint: token.id,
      label: token.name,
      value: token.id,
    })),
    false
  );

  return createdTokens.filter((token) => selectedIds.includes(token.id));
}

export async function askPostCreateAction(): Promise<PostCreateAction> {
  return check(
    await select({
      message: "Would you like to modify your key?",
      options: [
        { value: "done", label: "No" },
        {
          value: "revoke-again",
          label: "Yes, modify this key",
        },
        { value: "revoke-done", label: "Yes, delete this key" },
        { value: "again", label: "Create another key" },
      ],
    })
  ) as PostCreateAction;
}

export async function askCreateAnother(): Promise<boolean> {
  const answer = check(
    await select({
      message: "Create another token?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No, done" },
      ],
    })
  );
  return answer === "yes";
}

export function cancelPrompt(message: string): void {
  cancel(message);
}

export const logMessage = {
  info: (message: string): void => log.info(message),
  warn: (message: string): void => log.warn(message),
  error: (message: string): void => log.error(message),
};

export function showNote(message: string, title: string): void {
  note(message, title);
}

export function finishOutro(message: string): void {
  outro(message);
}

export function createSpinner(): ReturnType<typeof spinner> {
  return spinner();
}
