import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import { printNote } from "#src/terminal/note.ts";

function setStdoutColumns(columns: number | undefined): void {
  Object.defineProperty(process.stdout, "columns", {
    configurable: true,
    value: columns,
  });
}

function setStderrColumns(columns: number | undefined): void {
  Object.defineProperty(process.stderr, "columns", {
    configurable: true,
    value: columns,
  });
}

function contentBoxRows(output: string): string[] {
  return output
    .split("\n")
    .filter(
      (line) =>
        line.includes("│") &&
        !line.includes("╮") &&
        !line.includes("╯") &&
        !line.includes("◇")
    );
}

describe.serial("printNote", () => {
  let writeSpy: ReturnType<typeof spyOn>;
  let originalStdoutColumns: number | undefined;
  let originalStderrColumns: number | undefined;
  let originalEnvColumns: string | undefined;

  beforeEach(() => {
    originalStdoutColumns = process.stdout.columns;
    originalStderrColumns = process.stderr.columns;
    originalEnvColumns = process.env.COLUMNS;
    writeSpy = spyOn(process.stdout, "write").mockImplementation(mock());
  });

  afterEach(() => {
    writeSpy.mockRestore();
    setStdoutColumns(originalStdoutColumns);
    setStderrColumns(originalStderrColumns);
    if (originalEnvColumns === undefined) {
      delete process.env.COLUMNS;
    } else {
      process.env.COLUMNS = originalEnvColumns;
    }
  });

  test.serial(
    "writes boxed note with title, box chars, and message text",
    () => {
      setStdoutColumns(80);
      printNote("Set CF_API_TOKEN before running.", "Auth required");

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = String(writeSpy.mock.calls[0]?.[0]);

      expect(output).toContain("Auth required");
      expect(output).toContain("Set CF_API_TOKEN before running.");
      expect(output).toContain("◇");
      expect(output).toContain("│");
    }
  );

  test.serial(
    "truncates https:// lines that exceed width instead of wrapping",
    () => {
      setStdoutColumns(40);
      const longUrl =
        "https://dash.cloudflare.com/profile/api-tokens?accountId=*&name=create-cf-token";
      printNote(`Open ${longUrl} to create a token.`, "Dashboard");

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = String(writeSpy.mock.calls[0]?.[0]);

      expect(output).toContain("Dashboard");
      expect(output).toContain("https://");
      expect(output).toContain("…");
      expect(output).not.toContain(
        "Open https://dash.cloudflare.com/profile/api-tokens?accountId=*&name=create-cf-token to create a token."
      );
    }
  );

  test.serial("word-wraps long non-URL lines across multiple box rows", () => {
    setStdoutColumns(40);
    const longLine =
      "Export this token to your shell profile and restart your terminal session before running the CLI again.";
    printNote(longLine, "Next steps");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = String(writeSpy.mock.calls[0]?.[0]);

    expect(contentBoxRows(output).length).toBeGreaterThan(1);
    expect(output).toContain("Next steps");
    expect(output).toContain("terminal");
  });

  test.serial(
    "uses COLUMNS env when stdout and stderr columns are unavailable",
    () => {
      setStdoutColumns(undefined);
      setStderrColumns(undefined);
      process.env.COLUMNS = "36";

      const longLine =
        "This message should wrap because the effective terminal width comes from COLUMNS.";
      printNote(longLine, "Env width");

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = String(writeSpy.mock.calls[0]?.[0]);

      expect(contentBoxRows(output).length).toBeGreaterThan(1);
      expect(output).toContain("Env width");
    }
  );

  test.serial(
    "respects narrow terminal width with minimum content width",
    () => {
      setStdoutColumns(26);
      printNote("Short note body.", "Narrow");

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = String(writeSpy.mock.calls[0]?.[0]);

      expect(output).toContain("Narrow");
      expect(output).toContain("Short note body.");
      expect(output).toContain("│");
    }
  );
});
