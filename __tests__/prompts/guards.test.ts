import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

const actualClack = await import("@clack/prompts");
const mockCancel = mock(() => {});
const CANCELLED = Symbol("test-cancel");

mock.module("@clack/prompts", () => ({
  ...actualClack,
  cancel: mockCancel,
  isCancel: (value: unknown) => value === CANCELLED,
}));

const { check, exitIfNonInteractive } = await import("@/prompts/guards.ts");

const originalIsTTY = process.stdin.isTTY;

afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: originalIsTTY,
  });
  mockCancel.mockClear();
});

describe("check", () => {
  test("returns the value when not cancelled", () => {
    expect(check("hello")).toBe("hello");
    expect(check(42)).toBe(42);
  });

  test("calls cancel and exits 0 when value is cancelled", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );

    check(CANCELLED);

    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});

describe("exitIfNonInteractive", () => {
  test("does nothing when stdin.isTTY is true", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });

    exitIfNonInteractive();

    expect(mockCancel).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test("calls cancel and exits 1 when stdin is not a TTY", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });

    exitIfNonInteractive();

    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  test("calls cancel and exits 1 when stdin.isTTY is undefined", () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(
      () => undefined as never
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: undefined,
    });

    exitIfNonInteractive();

    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
