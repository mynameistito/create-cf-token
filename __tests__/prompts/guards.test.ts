import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

const actualClack = await import("@clack/prompts");
const mockCancel = mock(() => {});
const CANCELLED = Symbol("test-cancel");

mock.module("@clack/prompts", () => ({
  ...actualClack,
  cancel: mockCancel,
  isCancel: (value: unknown) => value === CANCELLED,
}));

const { check, exitIfNonInteractive, isPromptCancel } =
  await import("@/prompts/guards.ts");

const originalIsTTY = process.stdin.isTTY;

afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: originalIsTTY,
  });
  mockCancel.mockClear();
});

describe.serial("isPromptCancel", () => {
  test.serial("returns false when value is not cancelled", () => {
    expect(isPromptCancel("hello")).toBe(false);
    expect(isPromptCancel(42)).toBe(false);
  });

  test.serial("returns true when value is cancelled", () => {
    expect(isPromptCancel(CANCELLED)).toBe(true);
  });
});

describe.serial("check", () => {
  test.serial("returns the value when not cancelled", () => {
    expect(check("hello")).toBe("hello");
    expect(check(42)).toBe(42);
  });

  test.serial("calls cancel and throws when value is cancelled", () => {
    try {
      check(CANCELLED);
      expect.unreachable("check should throw on cancellation");
    } catch (error) {
      expect(error).toBe(CANCELLED);
    }

    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
  });
});

describe.serial("exitIfNonInteractive", () => {
  test.serial("does nothing when stdin.isTTY is true", () => {
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

  test.serial("calls cancel and exits 1 when stdin is not a TTY", () => {
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

  test.serial("calls cancel and exits 1 when stdin.isTTY is undefined", () => {
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
