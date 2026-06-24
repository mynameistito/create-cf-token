import { describe, expect, spyOn, test } from "bun:test";

import { SKILL_REFERENCE_FILES } from "#src/automation/paths.ts";
import {
  printAutomationHelp,
  printHelp,
  printSkill,
  printVersion,
} from "#src/cli/help.ts";

function captureConsoleLog(action: () => void): string {
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  try {
    action();
    return String(logSpy.mock.calls.at(-1)?.[0] ?? "");
  } finally {
    logSpy.mockRestore();
  }
}

describe("printHelp()", () => {
  test("prints usage and --help option", () => {
    const output = captureConsoleLog(() => {
      printHelp();
    });
    expect(output).toContain("Usage");
    expect(output).toContain("--help");
    expect(output).toContain("create-cf-token");
  });
});

describe("printAutomationHelp()", () => {
  test("prints non-interactive automation options", () => {
    const output = captureConsoleLog(() => {
      printAutomationHelp();
    });
    expect(output).toContain("automation");
    expect(output).toContain("--non-interactive");
    expect(output).toContain("--list-scopes");
  });
});

describe("printVersion()", () => {
  test("prints a semver version string", () => {
    const output = captureConsoleLog(() => {
      printVersion();
    });
    expect(output).toMatch(/^\d+\.\d+\.\d+/u);
  });
});

describe("printSkill()", () => {
  test("prints SKILL header and reference section titles from real assets", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await printSkill();
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = String(logSpy.mock.calls[0]?.[0]);
      expect(output).toContain("SKILL");
      for (const reference of SKILL_REFERENCE_FILES) {
        expect(output).toContain(reference.title);
      }
    } finally {
      logSpy.mockRestore();
    }
  });
});
