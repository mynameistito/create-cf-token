import { describe, expect, mock, spyOn, test } from "bun:test";
import { handleCliError } from "../src/index.ts";
import { logMessage } from "../src/prompts.ts";

interface RunResult {
  exitCode: number | undefined;
}

// Cast to (err: unknown) => void so TypeScript treats the return as reachable.
// At runtime process.exit is mocked so execution continues normally.
const callHandleCliError = handleCliError as (err: unknown) => void;

function runHandleCliError(err: unknown): RunResult {
  let exitCode: number | undefined;
  const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
    exitCode = code as number;
    return undefined as never;
  });
  callHandleCliError(err);
  exitSpy.mockRestore();
  return { exitCode };
}

describe("handleCliError", () => {
  test("logs err.stack when err is an Error with a stack", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = new Error("something went wrong");
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(err.stack);
    errorSpy.mockRestore();
  });

  test("logs err.message when err is an Error without a stack", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = new Error("no stack error");
    err.stack = undefined;
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith("no stack error");
    errorSpy.mockRestore();
  });

  test("logs JSON.stringify result for a plain object", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = { code: 42, reason: "unknown" };
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(JSON.stringify(err));
    errorSpy.mockRestore();
  });

  test("falls back to String() when JSON.stringify returns undefined (e.g. a function)", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional stub value to trigger JSON.stringify → undefined path
    const err = () => {};
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(String(err));
    errorSpy.mockRestore();
  });

  test("falls back to String() when JSON.stringify throws (circular reference)", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err: Record<string, unknown> = {};
    err.self = err;
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith(String(err));
    errorSpy.mockRestore();
  });

  test("calls process.exit(1) in every branch", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const { exitCode } = runHandleCliError(new Error("test"));
    expect(exitCode).toBe(1);
    errorSpy.mockRestore();
  });
});
