import colour from "@/terminal/colour.ts";

const ESCAPE_CHAR = String.fromCodePoint(27);
const BELL_CHAR = String.fromCodePoint(7);

const ANSI_RE = new RegExp(
  `${ESCAPE_CHAR}\\[[0-9;]*m|${ESCAPE_CHAR}\\][^${BELL_CHAR}]*${BELL_CHAR}`,
  "gu"
);

/** Strip all ANSI CSI and OSC escape sequences from a string, returning visible characters only. */
const strip = (s: string): string => s.replace(ANSI_RE, "");

/** Wrap a string in dim gray ANSI codes. */
const gray = (s: string): string => `\u001B[90m${s}\u001B[0m`;

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
    const bel = line.indexOf("\u0007", i + 2);
    if (bel !== -1) {
      return { hyperlink: line.slice(i + 2, bel) !== "8;;", next: bel + 1 };
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
    if (line[i] === "\u001B") {
      const skip = skipEscapeAt(line, i);
      if (skip) {
        if (skip.hyperlink !== undefined) {
          inHyperlink = skip.hyperlink;
        }
        i = skip.next;
        continue;
      }
    }
    visibleCount += 1;
    if (visibleCount >= maxWidth) {
      const closeLink = inHyperlink ? "\u001B]8;;\u0007" : "";
      return `${line.slice(0, i)}…${closeLink}${colour.RESET}`;
    }
    i += 1;
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

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\u001B") {
      const end = text.indexOf("m", i);
      if (end !== -1) {
        i = end;
        continue;
      }
    }
    visibleCount += 1;
    if (text[i] === " ") {
      lastSpaceIdx = i;
    }
    if (visibleCount > maxWidth) {
      return { splitIdx: lastSpaceIdx > 0 ? lastSpaceIdx : i };
    }
  }
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
