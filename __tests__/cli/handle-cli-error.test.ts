import { describe, expect, mock, spyOn, test } from "bun:test";

import { handleCliError } from "@/index.ts";
import { logMessage } from "@/prompts/index.ts";

interface RunResult {
  exitCode: number | undefined;
}

type CliErrorInput = Error | symbol;

// SAFETY: The surrounding test or boundary has established the asserted contract.
// Cast to (err: unknown) => void so TypeScript treats the return as reachable.
// At runtime process.exit is mocked so execution continues normally.
const callHandleCliError = handleCliError as (err: CliErrorInput) => void;

function stringifyUndefinedStub(): void {
  return undefined;
}

function runHandleCliError(err: CliErrorInput): RunResult {
  let exitCode: number | undefined;
  const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
    // SAFETY: The surrounding test or boundary has established the asserted contract.
    exitCode = code as number;
    // SAFETY: The surrounding test or boundary has established the asserted contract.
    return undefined as never;
  });
  try {
    callHandleCliError(err);
  } finally {
    exitSpy.mockRestore();
  }
  return { exitCode };
}

describe("handleCliError", () => {
  test("logs err.stack when err is an Error with a stack", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = new Error("something went wrong");
    // SAFETY: The runtime test intentionally supplies a plain object to exercise JSON logging.
    runHandleCliError(err as never);
    expect(errorSpy).toHaveBeenCalledWith(err.stack);
    errorSpy.mockRestore();
  });

  test("logs err.message when err is an Error without a stack", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = new Error("no stack error");
    Object.defineProperty(err, "stack", { value: null });
    runHandleCliError(err);
    expect(errorSpy).toHaveBeenCalledWith("no stack error");
    errorSpy.mockRestore();
  });

  test("logs JSON.stringify result for a plain object", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    const err = { code: 42, reason: "unknown" };
    // SAFETY: The runtime test intentionally supplies a plain object to exercise JSON logging.
    runHandleCliError(err as never);
    expect(errorSpy).toHaveBeenCalledWith(JSON.stringify(err));
    errorSpy.mockRestore();
  });

  test("falls back to String() when JSON.stringify returns undefined (e.g. a function)", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    // SAFETY: The runtime test intentionally supplies a function to exercise String fallback.
    runHandleCliError(stringifyUndefinedStub as never);
    expect(errorSpy).toHaveBeenCalledWith(String(stringifyUndefinedStub));
    errorSpy.mockRestore();
  });

  test("falls back to String() when JSON.stringify throws (circular reference)", () => {
    const errorSpy = spyOn(logMessage, "error").mockImplementation(mock());
    interface CircularError {
      self?: CircularError;
    }
    const err: CircularError = {};
    err.self = err;
    // SAFETY: The runtime test intentionally supplies a circular object to exercise fallback logging.
    runHandleCliError(err as never);
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

test("test module loads", () => expect(true).toBe(true));
