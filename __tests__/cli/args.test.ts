import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  hasCompleteTokenSpec,
  parseCliArgs,
  validateNonInteractiveSpec,
} from "@/cli/args.ts";

let previousEnvValue: string | undefined;
let previousIsTty: PropertyDescriptor | undefined;

beforeEach(() => {
  previousEnvValue = process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
  previousIsTty = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
});

afterEach(() => {
  if (previousEnvValue === undefined) {
    delete process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
  } else {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = previousEnvValue;
  }
  if (previousIsTty) {
    Object.defineProperty(process.stdin, "isTTY", previousIsTty);
  }
});

describe.serial("parseCliArgs", () => {
  test.serial("parses --help", () => {
    const result = parseCliArgs(["--help"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("help");
    }
  });

  test.serial("parses --help automation", () => {
    const result = parseCliArgs(["--help", "automation"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("help-automation");
    }
  });

  test.serial("parses --help skill as skill command", () => {
    const result = parseCliArgs(["--help", "skill"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("skill");
    }
  });

  test.serial("parses --skill", () => {
    const result = parseCliArgs(["--skill"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("skill");
    }
  });

  test.serial("parses non-interactive create flags", () => {
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
      expect(result.explicitNonInteractive).toBe(true);
      expect(result.command).toBe("create");
      expect(result.name).toBe("ci-token");
      expect(result.accounts).toBe("all");
      expect(result.scopes).toBe("Zone DNS:read");
      expect(result.output).toBe("json");
    }
  });

  test.serial("promotes -n alone to create command", () => {
    const result = parseCliArgs(["-n"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.explicitNonInteractive).toBe(true);
      expect(result.command).toBe("create");
    }
  });

  test.serial("parses discovery flags", () => {
    const result = parseCliArgs(["--list-scopes", "--json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("list-scopes");
      expect(result.format).toBe("json");
    }
  });

  test.serial("parses create --file -", () => {
    const result = parseCliArgs(["create", "--file", "-"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("create");
      expect(result.file).toBe("-");
    }
  });

  test.serial("preserves --format when discovery flag follows", () => {
    const result = parseCliArgs(["--format", "table", "--list-scopes"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.command).toBe("list-scopes");
      expect(result.format).toBe("table");
    }
  });

  test.serial("returns error for unknown flag", () => {
    const result = parseCliArgs(["--unknown-flag"]);
    expect("error" in result).toBe(true);
  });

  test.serial("returns error when required flag value is missing", () => {
    const result = parseCliArgs(["--name"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Missing value for --name");
    }
  });

  test.serial("returns error when required flag value is another flag", () => {
    const result = parseCliArgs(["--name", "--help"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Missing value for --name");
    }
  });

  test.serial("returns error for missing --format value", () => {
    const result = parseCliArgs(["--format"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        "Missing or invalid value for --format (expected json or table)"
      );
    }
  });

  test.serial("returns error for invalid --format value", () => {
    const result = parseCliArgs(["--format", "yaml"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        "Missing or invalid value for --format (expected json or table)"
      );
    }
  });

  test.serial("returns error for invalid --preset value", () => {
    const result = parseCliArgs(["--preset", "read-only"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        'Missing or invalid value for --preset (expected "full-access")'
      );
    }
  });

  test.serial("returns error for missing --output value", () => {
    const result = parseCliArgs(["--output"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        "Missing or invalid value for --output (expected json or text)"
      );
    }
  });

  test.serial("returns error for invalid --output value", () => {
    const result = parseCliArgs(["--output", "table"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        "Missing or invalid value for --output (expected json or text)"
      );
    }
  });

  test.serial("returns error for missing --file value", () => {
    const result = parseCliArgs(["--file"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Missing value for --file");
    }
  });

  test.serial("returns error for missing --accounts value", () => {
    const result = parseCliArgs(["--accounts"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Missing value for --accounts");
    }
  });

  test.serial("returns error for missing --scopes value", () => {
    const result = parseCliArgs(["--scopes"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Missing value for --scopes");
    }
  });

  test.serial("defaults format to json when stdin is not a TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      enumerable: previousIsTty?.enumerable ?? true,
      get: () => false,
    });

    const result = parseCliArgs([]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.format).toBe("json");
    }
  });

  test.serial(
    "promotes env non-interactive with create flags to create command",
    () => {
      process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "true";
      const result = parseCliArgs(["--name", "env-token"]);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.nonInteractive).toBe(true);
        expect(result.explicitNonInteractive).toBe(false);
        expect(result.command).toBe("create");
      }
    }
  );

  test.serial("parses --yes and --dry-run", () => {
    const result = parseCliArgs(["--yes", "--dry-run", "-n", "--name", "x"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.yes).toBe(true);
      expect(result.dryRun).toBe(true);
    }
  });
});

describe.serial("validateNonInteractiveSpec", () => {
  test.serial("requires name without file", () => {
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

  test.serial("accepts full-access preset", () => {
    const args = parseCliArgs(["-n", "--name", "x", "--preset", "full-access"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toBeNull();
    expect(hasCompleteTokenSpec(args)).toBe(true);
  });

  test.serial("accepts --file without name", () => {
    const args = parseCliArgs(["-n", "--file", "spec.json"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toBeNull();
    expect(hasCompleteTokenSpec(args)).toBe(true);
  });

  test.serial("requires scopes when name is set without preset", () => {
    const args = parseCliArgs(["-n", "--name", "x"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toContain("--scopes");
  });

  test.serial("requires accounts when scopes are set", () => {
    const args = parseCliArgs([
      "-n",
      "--name",
      "x",
      "--scopes",
      "Zone DNS:read",
    ]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toContain("--accounts");
  });

  test.serial("accepts name with scopes and accounts", () => {
    const args = parseCliArgs([
      "-n",
      "--name",
      "x",
      "--scopes",
      "Zone DNS:read",
      "--accounts",
      "all",
    ]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(validateNonInteractiveSpec(args)).toBeNull();
    expect(hasCompleteTokenSpec(args)).toBe(true);
  });
});
