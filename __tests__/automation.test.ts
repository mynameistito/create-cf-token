import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import {
  failIfNonInteractiveIncomplete,
  shouldRunAutomation,
} from "#src/automation.ts";
import { parseCliArgs } from "#src/cli-args.ts";

let previousEnvValue: string | undefined;

beforeEach(() => {
  previousEnvValue = process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
});

afterEach(() => {
  if (previousEnvValue === undefined) {
    delete process.env.CREATE_CF_TOKEN_NON_INTERACTIVE;
  } else {
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = previousEnvValue;
  }
});

describe("shouldRunAutomation", () => {
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
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
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
    process.env.CREATE_CF_TOKEN_NON_INTERACTIVE = "1";
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

  test("-n with discovery command forces automation without create spec", () => {
    const args = parseCliArgs(["-n", "--list-scopes"]);
    if ("error" in args) {
      throw new Error("unexpected parse error");
    }
    expect(args.command).toBe("list-scopes");
    expect(shouldRunAutomation(args)).toBe(true);
  });
});

describe("failIfNonInteractiveIncomplete", () => {
  test("-n with discovery command does not require create spec on TTY", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    const ttyDescriptor = Object.getOwnPropertyDescriptor(
      process.stdin,
      "isTTY"
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      enumerable: ttyDescriptor?.enumerable ?? true,
      get: () => true,
    });

    try {
      const args = parseCliArgs(["-n", "--list-scopes"]);
      if ("error" in args) {
        throw new Error("unexpected parse error");
      }

      failIfNonInteractiveIncomplete(args);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      if (ttyDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
      }
      exitSpy.mockRestore();
    }
  });
});
