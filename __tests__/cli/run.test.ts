import { afterEach, describe, expect, mock, test } from "bun:test";

import { run } from "@/cli/run.ts";

const mockMain = mock(() => Promise.resolve());
const mockHandleFlags = mock(() => false);
const mockHandleSkillFlag = mock(() => Promise.resolve(false));
const mockRunAutomationIfNeeded = mock(() => Promise.resolve(false));
const mockHandleCliError = mock((_error: unknown) => {});

const runDeps = {
  handleCliError: mockHandleCliError,
  handleFlags: mockHandleFlags,
  handleSkillFlag: mockHandleSkillFlag,
  main: mockMain,
  runAutomationIfNeeded: mockRunAutomationIfNeeded,
};

afterEach(() => {
  mockMain.mockReset();
  mockMain.mockReturnValue(Promise.resolve());
  mockHandleFlags.mockClear();
  mockHandleSkillFlag.mockClear();
  mockRunAutomationIfNeeded.mockClear();
  mockHandleCliError.mockClear();
});

describe.serial("run()", () => {
  test.serial("calls main() when handleFlags returns false", async () => {
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.resolve());
    run(runDeps);
    await Bun.sleep(0);
    expect(mockMain).toHaveBeenCalledTimes(1);
  });

  test.serial(
    "does not call main() when handleFlags returns true",
    async () => {
      mockHandleFlags.mockReturnValue(true);
      run(runDeps);
      await Bun.sleep(0);
      expect(mockMain).not.toHaveBeenCalled();
    }
  );

  test.serial("returns early when handleSkillFlag returns true", async () => {
    mockHandleFlags.mockReturnValue(false);
    mockHandleSkillFlag.mockReturnValue(Promise.resolve(true));
    run(runDeps);
    await Bun.sleep(0);
    expect(mockMain).not.toHaveBeenCalled();
    expect(mockRunAutomationIfNeeded).not.toHaveBeenCalled();
  });

  test.serial(
    "returns early when runAutomationIfNeeded returns true",
    async () => {
      mockHandleFlags.mockReturnValue(false);
      mockHandleSkillFlag.mockReturnValue(Promise.resolve(false));
      mockRunAutomationIfNeeded.mockReturnValue(Promise.resolve(true));
      run(runDeps);
      await Bun.sleep(0);
      expect(mockMain).not.toHaveBeenCalled();
    }
  );

  test.serial(
    "passes handleCliError as the catch handler when main() rejects",
    async () => {
      const err = new Error("boom");
      mockHandleFlags.mockReturnValue(false);
      mockHandleSkillFlag.mockReturnValue(Promise.resolve(false));
      mockRunAutomationIfNeeded.mockReturnValue(Promise.resolve(false));
      mockMain.mockImplementation(() => Promise.reject(err));
      await run(runDeps);
      expect(mockHandleCliError).toHaveBeenCalledWith(err);
    }
  );
});
