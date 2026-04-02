import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { handleCliError } from "../src/index.ts";
import { logMessage } from "../src/prompts.ts";

const mockMain = mock(() => Promise.resolve());
const mockHandleFlags = mock(() => false);

mock.module("../src/index.ts", () => ({
  main: mockMain,
  handleFlags: mockHandleFlags,
}));

const { run } = await import("../src/cli.ts");

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
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err = new Error("boom");
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.reject(err));
    run();
    await Bun.sleep(0);
    expect(errorSpy).toHaveBeenCalledWith(err.stack ?? err.message);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("handleCliError", () => {
  test("logs err.stack and exits with 1 for Error with stack", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err = new Error("boom");
    handleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(err.stack);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("logs err.message and exits with 1 for Error without stack", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err = new Error("no stack");
    err.stack = undefined;
    handleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(err.message);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("logs JSON.stringify and exits with 1 for plain object", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err = { code: 42 };
    handleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(JSON.stringify(err));
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("falls back to String and exits with 1 when JSON.stringify returns undefined", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional function value to test JSON.stringify → undefined
    const err = () => {};
    handleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(String(err));
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("falls back to String and exits with 1 when JSON.stringify throws", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to prevent log output during test
    const errorSpy = spyOn(logMessage, "error").mockImplementation(() => {});
    const err: Record<string, unknown> = {};
    err.self = err;
    handleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(String(err));
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
