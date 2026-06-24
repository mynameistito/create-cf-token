import { describe, expect, test } from "bun:test";

import {
  hasCompleteTokenSpec,
  parseCliArgs,
  validateNonInteractiveSpec,
} from "#src/cli-args.ts";

describe("parseCliArgs", () => {
  test("parses --help", () => {
    const result = parseCliArgs(["--help"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("help");
    }
  });

  test("parses --help automation", () => {
    const result = parseCliArgs(["--help", "automation"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("help-automation");
    }
  });

  test("parses --help skill as skill command", () => {
    const result = parseCliArgs(["--help", "skill"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("skill");
    }
  });

  test("parses --skill", () => {
    const result = parseCliArgs(["--skill"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("skill");
    }
  });

  test("parses non-interactive create flags", () => {
    const result = parseCliArgs([
      "-n",
      "--name",
      "ci-token",
      "--accounts",
      "all",
      "--scopes",
      "Zone DNS:read",
      "--output",
      "json",
    ]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.nonInteractive).toBe(true);
      expect(result.command).toBe("create");
      expect(result.name).toBe("ci-token");
      expect(result.accounts).toBe("all");
      expect(result.scopes).toBe("Zone DNS:read");
      expect(result.output).toBe("json");
    }
  });

  test("parses discovery flags", () => {
    const result = parseCliArgs(["--list-scopes", "--json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("list-scopes");
      expect(result.format).toBe("json");
    }
  });

  test("returns error for unknown flag", () => {
    const result = parseCliArgs(["--unknown-flag"]);
    expect("error" in result).toBe(true);
  });
});

describe("validateNonInteractiveSpec", () => {
  test("requires name without file", () => {
    const args = parseCliArgs([
      "-n",
      "--scopes",
      "x:read",
      "--accounts",
      "all",
    ]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toContain("--name");
  });

  test("accepts full-access preset", () => {
    const args = parseCliArgs(["-n", "--name", "x", "--preset", "full-access"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toBeNull();
    expect(hasCompleteTokenSpec(args)).toBe(true);
  });
});
