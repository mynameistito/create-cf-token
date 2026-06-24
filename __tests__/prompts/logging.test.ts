import { afterEach, describe, expect, mock, test } from "bun:test";

const actualClack = await import("@clack/prompts");

const mockCancel = mock(() => {});
const mockLogError = mock(() => {});
const mockLogInfo = mock(() => {});
const mockLogWarn = mock(() => {});
const mockOutro = mock(() => {});
const realSpinner = actualClack.spinner();
const mockSpinnerStart = mock(() => {});
const mockSpinnerStop = mock(() => {});
const mockSpinnerMessage = mock(() => {});
const mockSpinner = mock(() => ({
  ...realSpinner,
  message: mockSpinnerMessage,
  start: mockSpinnerStart,
  stop: mockSpinnerStop,
}));

mock.module("@clack/prompts", () => ({
  ...actualClack,
  cancel: mockCancel,
  log: {
    error: mockLogError,
    info: mockLogInfo,
    warn: mockLogWarn,
  },
  outro: mockOutro,
  spinner: mockSpinner,
}));

const { cancelPrompt, createSpinner, finishOutro, logMessage } =
  await import("#src/prompts/logging.ts");

afterEach(() => {
  mockCancel.mockClear();
  mockLogError.mockClear();
  mockLogInfo.mockClear();
  mockLogWarn.mockClear();
  mockOutro.mockClear();
  mockSpinner.mockClear();
  mockSpinnerStart.mockClear();
  mockSpinnerStop.mockClear();
  mockSpinnerMessage.mockClear();
});

describe.serial("cancelPrompt", () => {
  test.serial("forwards message to clack cancel", () => {
    cancelPrompt("Operation aborted.");

    expect(mockCancel).toHaveBeenCalledWith("Operation aborted.");
  });
});

describe.serial("logMessage", () => {
  test.serial("info forwards to clack log.info", () => {
    logMessage.info("Fetching accounts…");

    expect(mockLogInfo).toHaveBeenCalledWith("Fetching accounts…");
  });

  test.serial("warn forwards to clack log.warn", () => {
    logMessage.warn("Permission excluded.");

    expect(mockLogWarn).toHaveBeenCalledWith("Permission excluded.");
  });

  test.serial("error forwards to clack log.error", () => {
    logMessage.error("Token creation failed.");

    expect(mockLogError).toHaveBeenCalledWith("Token creation failed.");
  });
});

describe.serial("finishOutro", () => {
  test.serial("forwards message to clack outro", () => {
    finishOutro("Done! Token saved.");

    expect(mockOutro).toHaveBeenCalledWith("Done! Token saved.");
  });
});

describe.serial("createSpinner", () => {
  test.serial("returns a clack spinner instance", () => {
    const spinnerInstance = createSpinner();

    expect(mockSpinner).toHaveBeenCalledTimes(1);
    expect(spinnerInstance).toMatchObject({
      message: mockSpinnerMessage,
      start: mockSpinnerStart,
      stop: mockSpinnerStop,
    });
  });
});
