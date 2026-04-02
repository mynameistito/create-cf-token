import { afterEach, describe, expect, mock, test } from "bun:test";

const mockMain = mock(() => Promise.resolve());
const mockHandleFlags = mock(() => false);
// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op mock
const mockHandleCliError = mock((_err: unknown) => {});

mock.module("../src/index.ts", () => ({
  main: mockMain,
  handleFlags: mockHandleFlags,
  handleCliError: mockHandleCliError,
}));

// Import after mock.module so cli.ts picks up the mocked index.ts
const { run } = await import("../src/cli.ts");

afterEach(() => {
  mockMain.mockClear();
  mockHandleFlags.mockClear();
  mockHandleCliError.mockClear();
});

describe("run()", () => {
  test("calls main() when handleFlags returns false", async () => {
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.resolve());
    run();
    await Bun.sleep(0); // allow the microtask queue to flush
    expect(mockMain).toHaveBeenCalledTimes(1);
  });

  test("does not call main() when handleFlags returns true", async () => {
    mockHandleFlags.mockReturnValue(true);
    run();
    await Bun.sleep(0);
    expect(mockMain).not.toHaveBeenCalled();
  });

  test("passes handleCliError as the catch handler when main() rejects", async () => {
    const err = new Error("boom");
    mockHandleFlags.mockReturnValue(false);
    mockMain.mockReturnValue(Promise.reject(err));
    run();
    await Bun.sleep(0);
    expect(mockHandleCliError).toHaveBeenCalledWith(err);
  });
});
