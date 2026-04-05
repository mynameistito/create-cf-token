import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { handleCliError } from "#src/index.ts";
import { logMessage } from "#src/prompts.ts";

const mockMain = mock(() => Promise.resolve());
const mockHandleFlags = mock(() => false);
const mockHandleCliError = mock(handleCliError);

mock.module("#src/index.ts", () => ({
  main: mockMain,
  handleFlags: mockHandleFlags,
  handleCliError: mockHandleCliError,
}));

const { run } = await import("#src/cli.ts");

afterEach(() => {
  mockMain.mockClear();
  mockHandleFlags.mockClear();
});

describe("run()", () => {
  test("calls main() when handleFlags returns false", async () => {
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.resolve());
    run();
    await Bun.sleep(0);
    expect(mockMain).toHaveBeenCalledTimes(1);
  });

  test("does not call main() when handleFlags returns true", async () => {
    mockHandleFlags.mockReturnValue(true);
    run();
    await Bun.sleep(0);
    expect(mockMain).not.toHaveBeenCalled();
  });

  test("passes handleCliError as the catch handler when main() rejects", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err = new Error("boom");
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.reject(err));
    run();
    await Bun.sleep(0);
    expect(mockHandleCliError).toHaveBeenCalledWith(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
