import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { GO_BACK } from "#src/prompts/types.ts";
import type { SearchOption } from "#src/prompts/types.ts";
import type { Account } from "#src/types/index.ts";

const actualClack = await import("@clack/prompts");

const mockSelect = mock<(options: { message: string }) => Promise<string>>(() =>
  Promise.resolve("custom")
);
const mockPassword = mock<
  (options: {
    message: string;
    validate: (value: string) => string | undefined;
  }) => Promise<string>
>(() => Promise.resolve("typed-api-token"));
const mockNote = mock<(body: string, title: string) => void>(() => {});
const mockSearchMultiselect = mock<
  (
    message: string,
    options: SearchOption[],
    allowBack: boolean
  ) => Promise<string[]>
>(() => Promise.resolve(["acc-1"]));
const mockTextWithBack = mock<
  (message: string, initialValue: string) => Promise<string | typeof GO_BACK>
>(() => Promise.resolve("my-token-name"));

mock.module("@clack/prompts", () => ({
  ...actualClack,
  note: mockNote,
  password: mockPassword,
  select: mockSelect,
}));

const { askCredentials } = await import("#src/prompts/flow/credentials.ts");
const { askTokenPreset } = await import("#src/prompts/flow/preset.ts");
const { askPostCreateAction, showCreatedToken } =
  await import("#src/prompts/flow/post-create.ts");

const ACCOUNTS: Account[] = [
  { id: "acc-1", name: "Production" },
  { id: "acc-2", name: "Staging" },
];

const originalEnvToken = process.env.CF_API_TOKEN;
const originalIsTTY = process.stdin.isTTY;

function setStdinTTY(isTTY: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: isTTY,
  });
}

beforeEach(() => {
  setStdinTTY(true);
  mockSelect.mockImplementation(() => Promise.resolve("custom"));
  mockPassword.mockImplementation(() => Promise.resolve("typed-api-token"));
  mockSearchMultiselect.mockImplementation(() => Promise.resolve(["acc-1"]));
  mockTextWithBack.mockImplementation(() => Promise.resolve("my-token-name"));
});

afterEach(() => {
  if (originalEnvToken === undefined) {
    delete process.env.CF_API_TOKEN;
  } else {
    process.env.CF_API_TOKEN = originalEnvToken;
  }
  setStdinTTY(originalIsTTY);
  mockSelect.mockClear();
  mockPassword.mockClear();
  mockNote.mockClear();
  mockSearchMultiselect.mockClear();
  mockTextWithBack.mockClear();
});

describe.serial("selectAccounts", () => {
  test.serial(
    "maps accounts to multiselect options and filters by selected ids",
    async () => {
      mockSearchMultiselect.mockImplementation(() =>
        Promise.resolve(["acc-2"])
      );
      const { selectAccounts } = await import("#src/prompts/flow/accounts.ts");

      const result = await selectAccounts(ACCOUNTS, {
        searchMultiselect: mockSearchMultiselect,
      });

      expect(mockSearchMultiselect).toHaveBeenCalledWith(
        "Select accounts",
        [
          { hint: "acc-1", label: "Production", value: "acc-1" },
          { hint: "acc-2", label: "Staging", value: "acc-2" },
        ],
        false
      );
      expect(result).toEqual([{ id: "acc-2", name: "Staging" }]);
    }
  );
});

describe.serial("askCredentials", () => {
  test.serial("returns CF_API_TOKEN from env without prompting", async () => {
    process.env.CF_API_TOKEN = "env-api-token";

    const result = await askCredentials();

    expect(result).toEqual({ apiKey: "env-api-token" });
    expect(mockPassword).not.toHaveBeenCalled();
  });

  test.serial("prompts for password when env token is unset", async () => {
    delete process.env.CF_API_TOKEN;

    const result = await askCredentials();

    expect(result).toEqual({ apiKey: "typed-api-token" });
    expect(mockPassword).toHaveBeenCalledTimes(1);
    const passwordArgs = mockPassword.mock.calls[0]?.[0];
    expect(passwordArgs?.message).toContain("Cloudflare API Token");
    expect(passwordArgs?.validate("")).toBe("API token is required");
    expect(passwordArgs?.validate("ok")).toBeUndefined();
  });

  test.serial("prompts when env token is a placeholder", async () => {
    process.env.CF_API_TOKEN = "your_token_here";

    const result = await askCredentials();

    expect(result).toEqual({ apiKey: "typed-api-token" });
    expect(mockPassword).toHaveBeenCalledTimes(1);
  });
});

describe.serial("askTokenPreset", () => {
  test.serial("returns preset from select prompt", async () => {
    mockSelect.mockImplementation(() => Promise.resolve("full-access"));

    const result = await askTokenPreset();

    expect(result).toBe("full-access");
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: "custom",
        message: "Token permissions",
      })
    );
  });
});

describe.serial("askPostCreateAction", () => {
  test.serial("returns post-create action from select prompt", async () => {
    mockSelect.mockImplementation(() => Promise.resolve("again"));

    const result = await askPostCreateAction();

    expect(result).toBe("again");
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: "done",
        message: "What should we do with the key you just created?",
      })
    );
  });
});

describe.serial("showCreatedToken", () => {
  test.serial("displays token value and management URL in a note", () => {
    showCreatedToken("secret-token-value", "My Token");

    expect(mockNote).toHaveBeenCalledTimes(1);
    const [body, title] = mockNote.mock.calls[0] ?? [];
    expect(title).toBe("Token created: My Token");
    expect(body).toContain("secret-token-value");
    expect(body).toContain("Copy this token now.");
    expect(body).toContain("https://");
  });
});

describe.serial("askTokenName", () => {
  test.serial("delegates to textWithBack with default name", async () => {
    const { askTokenName } = await import("#src/prompts/flow/token-name.ts");

    const result = await askTokenName("create-cf-token-abc", {
      textWithBack: mockTextWithBack,
    });

    expect(result).toBe("my-token-name");
    expect(mockTextWithBack).toHaveBeenCalledWith(
      "Token name",
      "create-cf-token-abc"
    );
  });

  test.serial("propagates GO_BACK from textWithBack", async () => {
    mockTextWithBack.mockImplementation(() => Promise.resolve(GO_BACK));
    const { askTokenName } = await import("#src/prompts/flow/token-name.ts");

    const result = await askTokenName("default", {
      textWithBack: mockTextWithBack,
    });

    expect(result).toBe(GO_BACK);
  });
});
