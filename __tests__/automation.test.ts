import { afterEach, describe, expect, test } from "bun:test";

import { shouldRunAutomation } from "#src/automation.ts";
import { parseCliArgs } from "#src/cli-args.ts";

const ENV_KEY = "CREATE_CF_TOKEN_NON_INTERACTIVE";

describe("shouldRunAutomation", () => {
  afterEach(() => {
    process.env[ENV_KEY] = undefined;
  });

  test("-n alone forces automation", () => {
    const args = parseCliArgs(["-n"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(args.explicitNonInteractive).toBe(true);
    expect(args.command).toBe("create");
    expect(shouldRunAutomation(args)).toBe(true);
  });

  test("env-only non-interactive without create flags does not force automation", () => {
    process.env[ENV_KEY] = "1";
    const args = parseCliArgs([]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(args.nonInteractive).toBe(true);
    expect(args.explicitNonInteractive).toBe(false);
    expect(args.command).toBe("interactive");
    expect(shouldRunAutomation(args)).toBe(false);
  });

  test("env non-interactive with create flags still forces automation", () => {
    process.env[ENV_KEY] = "1";
    const args = parseCliArgs([
      "--name",
      "ci-token",
      "--preset",
      "full-access",
    ]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(args.explicitNonInteractive).toBe(false);
    expect(args.command).toBe("create");
    expect(shouldRunAutomation(args)).toBe(true);
  });
});
