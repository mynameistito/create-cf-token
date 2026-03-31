import {
  cancel,
  isCancel,
  log,
  multiselect,
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

function isLeft(key: KeyInfo): boolean {
  return key.name === "left" || key.sequence === "\x1b[D";
}

function isRight(key: KeyInfo): boolean {
  return key.name === "right" || key.sequence === "\x1b[C";
}

function withArrowSelect<T>(
  options: Array<{ value: string }>,
  fn: () => Promise<T>
): Promise<T> {
  let shadowCursor = 0;
  const shadowSelected = new Set<string>();
  const n = options.length;
  const emitter = process.stdin as NodeJS.EventEmitter;
  const original = emitter.emit.bind(emitter);
  const spaceKey: KeyInfo = {
    name: "space",
    sequence: " ",
    ctrl: false,
    meta: false,
  };
  const enterKey: KeyInfo = {
    name: "return",
    sequence: "\r",
    ctrl: false,
    meta: false,
  };

  function moveCursor(dir: "up" | "down"): void {
    shadowCursor =
      dir === "up" ? (shadowCursor - 1 + n) % n : (shadowCursor + 1) % n;
  }

  function toggleCurrent(val: string): void {
    if (shadowSelected.has(val)) {
      shadowSelected.delete(val);
    } else {
      shadowSelected.add(val);
    }
  }

  function handleRight(val: string | undefined): boolean {
    if (val && !shadowSelected.has(val)) {
      shadowSelected.add(val);
      return original("keypress", " ", spaceKey);
    }
    return true;
  }

  function handleLeft(val: string | undefined): boolean {
    if (val && shadowSelected.has(val)) {
      shadowSelected.delete(val);
      return original("keypress", " ", spaceKey);
    }
    return true;
  }

  function handleKeypress(key: KeyInfo): boolean | undefined {
    const val = options[shadowCursor]?.value;
    if (key.name === "up" || key.name === "down") {
      moveCursor(key.name);
    } else if (key.name === "space" && val) {
      toggleCurrent(val);
    } else if (isRight(key)) {
      return handleRight(val);
    } else if (isLeft(key)) {
      return handleLeft(val);
    } else if (
      (key.name === "return" || key.name === "enter") &&
      shadowSelected.size === 0 &&
      val
    ) {
      shadowSelected.add(val);
      original("keypress", " ", spaceKey);
      return original("keypress", "\r", enterKey);
    }
    return undefined;
  }

  emitter.emit = (event, ...args) => {
    const key = args[1] as KeyInfo | undefined;
    if (event === "keypress" && key) {
      const result = handleKeypress(key);
      if (result !== undefined) {
        return result;
      }
    }
    return original(event, ...args);
  };

  return fn().finally(() => {
    Reflect.deleteProperty(emitter, "emit");
  });
}

export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const options = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    hint: a.id,
  }));
  const ids = check(
    await withArrowSelect(options, () =>
      multiselect({
        message: `Select accounts  ${colour.DIM}· space to toggle · enter to confirm${colour.RESET}`,
        options,
        required: true,
      })
    )
  );
  return accounts.filter((a) => ids.includes(a.id));
}

interface KeyInfo {
  ctrl: boolean;
  meta: boolean;
  name: string;
  sequence: string;
}

export async function selectScopes(
  scopes: ServiceGroup[]
): Promise<PermissionGroup[]> {
  const scopeOptions = scopes.map((svc) => {
    const levels = svc.perms.map(
      (pg) => pg.name.replace(svc.name, "").trim() || pg.name
    );
    const scopeLabels = svc.scopes.map((s) => s.split(".").pop());
    return {
      value: svc.name,
      label: svc.name,
      hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
    };
  });
  const selected = check(
    await withArrowSelect(scopeOptions, () =>
      multiselect({
        message: `Select scopes  ${colour.DIM}· space to toggle · enter to confirm${colour.RESET}`,
        options: scopeOptions,
        required: true,
      })
    )
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
