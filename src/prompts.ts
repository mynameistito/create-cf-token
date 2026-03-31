import readline from "node:readline";
import {
  cancel,
  isCancel,
  log,
  note,
  outro,
  password,
  select,
  spinner,
  text,
} from "@clack/prompts";
import colour from "./colour.ts";
import type { Account, PermissionGroup, ServiceGroup } from "./types.ts";

export const CF_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires matching control chars
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const strip = (s: string): string => s.replace(ANSI_RE, "");
const gray = (s: string): string => `\x1b[90m${s}\x1b[0m`;

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

export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const ids = check(
    await searchableMultiselect({
      message: "Select accounts",
      options: accounts.map((a) => ({
        value: a.id,
        label: a.name,
        hint: a.id,
      })),
      showSearch: false,
      requiredMessage: "Please select at least one account.",
    })
  );
  return accounts.filter((a) => (ids as string[]).includes(a.id));
}

interface SearchOption {
  hint?: string;
  label: string;
  value: string;
}

interface KeyInfo {
  ctrl: boolean;
  meta: boolean;
  name: string;
  sequence: string;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) {
    return true;
  }
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi++;
    }
  }
  return qi === q.length;
}

const MAX_VISIBLE = 10;

function buildItemLine(
  opt: SearchOption,
  absIdx: number,
  cursor: number,
  selected: Set<string>
): string {
  const isCursor = absIdx === cursor;
  const isSel = selected.has(opt.value);
  const pointer = isCursor ? `${colour.CYAN}›${colour.RESET}` : " ";
  const box = isSel
    ? `${colour.GREEN}◼${colour.RESET}`
    : `${colour.DIM}◻${colour.RESET}`;
  const label = isCursor
    ? `${colour.CYAN}${opt.label}${colour.RESET}`
    : opt.label;
  const hint = opt.hint ? `  ${gray(opt.hint)}` : "";
  return `${gray("│")}  ${pointer} ${box} ${label}${hint}`;
}

function buildListLines(
  visible: SearchOption[],
  query: string,
  cursor: number,
  selected: Set<string>,
  scrollOffset: number,
  hasAbove: boolean,
  hasBelow: boolean
): string[] {
  const lines: string[] = [];
  if (visible.length === 0) {
    lines.push(
      `${gray("│")}  ${colour.DIM}No scopes match "${query}"${colour.RESET}`
    );
    return lines;
  }
  if (hasAbove) {
    lines.push(`${gray("│")}  ${colour.DIM}↑ more above${colour.RESET}`);
  }
  for (let i = 0; i < visible.length; i++) {
    const opt = visible[i];
    if (!opt) {
      continue;
    }
    lines.push(buildItemLine(opt, scrollOffset + i, cursor, selected));
  }
  if (hasBelow) {
    lines.push(`${gray("│")}  ${colour.DIM}↓ more below${colour.RESET}`);
  }
  return lines;
}

function searchableMultiselect({
  message,
  options,
  showSearch = true,
  requiredMessage = "Please select at least one item.",
}: {
  message: string;
  options: SearchOption[];
  showSearch?: boolean;
  requiredMessage?: string;
}): Promise<string[] | symbol> {
  const cols =
    process.stdout.columns ||
    process.stderr.columns ||
    Number(process.env.COLUMNS) ||
    80;

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let query = "";
    let cursor = 0;
    let scrollOffset = 0;
    let errorMsg = "";
    const selected = new Set<string>();
    let renderedLines = 0;

    const getFiltered = (): SearchOption[] =>
      showSearch && query
        ? options.filter((o) => fuzzyMatch(query, o.label))
        : options;

    function clearRender(): void {
      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A\x1b[0J`);
        renderedLines = 0;
      }
    }

    function adjustScroll(filteredLen: number): void {
      if (filteredLen === 0) {
        cursor = 0;
      } else if (cursor >= filteredLen) {
        cursor = filteredLen - 1;
      }
      if (cursor < scrollOffset) {
        scrollOffset = cursor;
      }
      if (cursor >= scrollOffset + MAX_VISIBLE) {
        scrollOffset = cursor - MAX_VISIBLE + 1;
      }
    }

    function render(): void {
      clearRender();
      const filtered = getFiltered();
      adjustScroll(filtered.length);

      const dashes = Math.max(cols - strip(message).length - 5, 0);
      const visible = filtered.slice(scrollOffset, scrollOffset + MAX_VISIBLE);
      const hasAbove = scrollOffset > 0;
      const hasBelow = scrollOffset + MAX_VISIBLE < filtered.length;

      const lines: string[] = [
        `${colour.GREEN}◆${colour.RESET}  ${message} ${gray("─".repeat(dashes))}`,
        ...(showSearch
          ? [
              `${gray("│")}  ${colour.DIM}Search:${colour.RESET} ${colour.WHITE}${query}${colour.RESET}${colour.DIM}▌${colour.RESET}`,
              gray("│"),
            ]
          : []),
        ...buildListLines(
          visible,
          query,
          cursor,
          selected,
          scrollOffset,
          hasAbove,
          hasBelow
        ),
        gray("│"),
        ...(errorMsg
          ? [`${gray("│")}  \x1b[31m${errorMsg}${colour.RESET}`]
          : []),
        `${gray("└")}  ${colour.DIM}space/→ select · ↑↓ navigate · enter confirm · ctrl+c cancel${colour.RESET}`,
      ];

      process.stdout.write(`${lines.join("\n")}\n`);
      renderedLines = lines.length;
    }

    function finish(value: string[] | symbol): void {
      process.stdin.removeListener("keypress", onKey);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw ?? false);
      }
      clearRender();
      if (Array.isArray(value) && value.length > 0) {
        const labels = options
          .filter((o) => (value as string[]).includes(o.value))
          .map((o) => o.label)
          .join(", ");
        const summary = labels.length > 40 ? `${labels.slice(0, 37)}…` : labels;
        const dashes = Math.max(
          cols - strip(message).length - strip(summary).length - 7,
          1
        );
        process.stdout.write(
          `${gray("◇")}  ${message} ${gray("─".repeat(dashes))}  ${colour.DIM}${summary}${colour.RESET}\n`
        );
      }
      resolve(value);
    }

    function handleEnter(): void {
      const filtered = getFiltered();
      const item = filtered[cursor];
      if (item && !selected.has(item.value)) {
        selected.add(item.value);
      }
      if (selected.size === 0) {
        errorMsg = requiredMessage;
        render();
        return;
      }
      finish([...selected]);
    }

    function handleSpace(): void {
      const filtered = getFiltered();
      const item = filtered[cursor];
      if (item) {
        if (selected.has(item.value)) {
          selected.delete(item.value);
        } else {
          selected.add(item.value);
        }
      }
      render();
    }

    function handleSelect(): void {
      const filtered = getFiltered();
      const item = filtered[cursor];
      if (item) {
        selected.add(item.value);
      }
      render();
    }

    function handleDeselect(): void {
      const filtered = getFiltered();
      const item = filtered[cursor];
      if (item) {
        selected.delete(item.value);
      }
      render();
    }

    function handleNav(dir: 1 | -1): void {
      const filtered = getFiltered();
      const next = cursor + dir;
      if (next >= 0 && next < filtered.length) {
        cursor = next;
      }
      render();
    }

    function handleType(ch: string): void {
      query += ch;
      cursor = 0;
      scrollOffset = 0;
      render();
    }

    function handleBackspace(): void {
      if (query.length > 0) {
        query = query.slice(0, -1);
        cursor = 0;
        scrollOffset = 0;
        render();
      }
    }

    function isPrintable(key: KeyInfo): boolean {
      return (
        Boolean(key.sequence) &&
        !key.ctrl &&
        !key.meta &&
        key.sequence.length === 1 &&
        key.sequence.charCodeAt(0) >= 32
      );
    }

    const keyMap: Record<string, (() => void) | undefined> = {
      space: handleSpace,
      up: () => handleNav(-1),
      down: () => handleNav(1),
      backspace: handleBackspace,
    };

    function isLeft(key: KeyInfo): boolean {
      return key.name === "left" || key.sequence === "\x1b[D";
    }

    function isRight(key: KeyInfo): boolean {
      return key.name === "right" || key.sequence === "\x1b[C";
    }

    function onKey(_: unknown, key: KeyInfo): void {
      if (!key) {
        return;
      }
      errorMsg = "";

      if (key.ctrl && key.name === "c") {
        finish(Symbol("cancel"));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        handleEnter();
        return;
      }
      if (isLeft(key)) {
        handleDeselect();
        return;
      }
      if (isRight(key)) {
        handleSelect();
        return;
      }
      const handler = keyMap[key.name];
      if (handler) {
        handler();
        return;
      }
      if (isPrintable(key)) {
        handleType(key.sequence);
      }
    }

    process.stdin.on("keypress", onKey);
    render();
  });
}

export async function selectScopes(
  scopes: ServiceGroup[]
): Promise<PermissionGroup[]> {
  const selected = check(
    await searchableMultiselect({
      message: "Select scopes",
      options: scopes.map((svc) => {
        const levels = svc.perms.map(
          (pg) => pg.name.replace(svc.name, "").trim() || pg.name
        );
        const scopeLabels = svc.scopes.map((s) => s.split(".").pop());
        return {
          value: svc.name,
          label: svc.name,
          hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
        };
      }),
    })
  );

  const chosen: PermissionGroup[] = [];

  for (const scopeName of selected as string[]) {
    const svc = scopes.find((s) => s.name === scopeName);
    if (!svc) {
      continue;
    }

    chosen.push(...svc.otherPerms);

    if (svc.readPerm && svc.writePerm) {
      const level = check(
        await select({
          message: `${svc.name} — access level`,
          options: [
            { value: "read", label: "Read only" },
            { value: "write", label: "Read + Write" },
          ],
        })
      );
      chosen.push(svc.readPerm);
      if (level === "write") {
        chosen.push(svc.writePerm);
      }
    } else {
      if (svc.readPerm) {
        chosen.push(svc.readPerm);
      }
      if (svc.writePerm) {
        chosen.push(svc.writePerm);
      }
    }
  }

  return chosen;
}

export async function askTokenName(defaultName: string): Promise<string> {
  return check(
    await text({
      message: "Token name",
      initialValue: defaultName,
      validate: (v) => (v ? undefined : "Name is required"),
    })
  );
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
