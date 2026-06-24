import { afterEach, describe, expect, mock, test } from "bun:test";

import { GO_BACK } from "@/prompts/types.ts";
import type {
  SearchPromptState,
  SelectPromptState,
  TextPromptState,
} from "@/prompts/types.ts";

const actualClack = await import("@clack/prompts");

let withGuide = false;

mock.module("@clack/prompts", () => ({
  ...actualClack,
  get settings() {
    return { withGuide };
  },
}));

const { getHeaderLines, submitGoBack } =
  await import("@/prompts/render/shared.ts");
const { renderSearchPrompt } = await import("@/prompts/render/search.ts");
const { renderSelectPrompt } = await import("@/prompts/render/select.ts");
const { renderTextPrompt } = await import("@/prompts/render/text.ts");

const SEARCH_OPTIONS = [
  { hint: "Read DNS records", label: "DNS Read", value: "dns-read" },
  { disabled: true, label: "DNS Write", value: "dns-write" },
];

function baseSearchState(
  overrides: Partial<SearchPromptState> = {}
): SearchPromptState {
  return {
    cursor: 0,
    error: "",
    filteredOptions: SEARCH_OPTIONS,
    focusedValue: "dns-read",
    isNavigating: false,
    options: SEARCH_OPTIONS,
    selectedValues: ["dns-read"],
    state: "active",
    userInput: "",
    userInputWithCursor: "",
    ...overrides,
  };
}

function baseSelectState(
  overrides: Partial<SelectPromptState> = {}
): SelectPromptState {
  return {
    cursor: 0,
    error: "",
    options: SEARCH_OPTIONS,
    state: "active",
    value: "dns-read",
    ...overrides,
  };
}

function baseTextState(
  overrides: Partial<TextPromptState> = {}
): TextPromptState {
  return {
    error: "",
    state: "active",
    userInput: "create-cf-token",
    userInputWithCursor: "create-cf-token|",
    ...overrides,
  };
}

afterEach(() => {
  withGuide = false;
});

describe("getHeaderLines", () => {
  test("renders symbol and message without guide rail", () => {
    const lines = getHeaderLines(
      { error: "", state: "active" },
      "Select accounts",
      false
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Select accounts");
  });

  test("prepends guide bar when withGuide is enabled", () => {
    const lines = getHeaderLines(
      { error: "", state: "error" },
      "Token name",
      true
    );

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Token name");
  });
});

describe("submitGoBack", () => {
  test("sets GO_BACK value and submit state on prompt", () => {
    const prompt: { state: "active" | "submit" } = { state: "active" };

    submitGoBack(prompt);

    expect(prompt.state).toBe("submit");
    expect(Reflect.get(prompt, "value")).toBe(GO_BACK);
  });
});

describe("renderSearchPrompt", () => {
  test("active state shows search field, options, and footer hints", () => {
    const output = renderSearchPrompt(
      baseSearchState({ userInputWithCursor: "dns|" }),
      "Select scopes",
      true
    );

    expect(output).toContain("Select scopes");
    expect(output).toContain("Search:");
    expect(output).toContain("DNS Read");
    expect(output).toContain("go back");
    expect(output).toContain("Ctrl+A/a:");
  });

  test("error state uses yellow accent and shows validation message", () => {
    const output = renderSearchPrompt(
      baseSearchState({
        error: "Please select at least one item",
        state: "error",
      }),
      "Select scopes",
      false
    );

    expect(output).toContain("Please select at least one item");
  });

  test("submit state shows selected count", () => {
    const output = renderSearchPrompt(
      baseSearchState({ state: "submit" }),
      "Select scopes",
      false
    );

    expect(output).toContain("1 items selected");
  });

  test("cancel state strikes through user input", () => {
    const output = renderSearchPrompt(
      baseSearchState({
        state: "cancel",
        userInput: "dns",
      }),
      "Select scopes",
      false
    );

    expect(output).toContain("dns");
  });

  test("shows no matches when filter returns empty results", () => {
    const output = renderSearchPrompt(
      baseSearchState({
        filteredOptions: [],
        userInput: "missing",
        userInputWithCursor: "missing|",
      }),
      "Select scopes",
      false
    );

    expect(output).toContain("No matches found");
  });

  test("renders disabled options with strikethrough styling", () => {
    const output = renderSearchPrompt(
      baseSearchState(),
      "Select scopes",
      false
    );

    expect(output).toContain("DNS Write");
  });

  test("includes guide rail footer when withGuide is enabled", () => {
    withGuide = true;

    const output = renderSearchPrompt(
      baseSearchState(),
      "Select scopes",
      false
    );

    expect(output.split("\n").length).toBeGreaterThan(3);
  });
});

describe("renderSelectPrompt", () => {
  test("active state lists options with navigation hints", () => {
    const output = renderSelectPrompt(
      baseSelectState(),
      "Token permissions",
      true
    );

    expect(output).toContain("Token permissions");
    expect(output).toContain("DNS Read");
    expect(output).toContain("go back");
    expect(output).toContain("navigate");
  });

  test("error state shows validation message", () => {
    const output = renderSelectPrompt(
      baseSelectState({
        error: "Selection required",
        state: "error",
      }),
      "Token permissions",
      false
    );

    expect(output).toContain("Selection required");
  });

  test("submit state shows selected label", () => {
    const output = renderSelectPrompt(
      baseSelectState({ state: "submit" }),
      "Token permissions",
      false
    );

    expect(output).toContain("DNS Read");
  });

  test("cancel state strikes through selected label", () => {
    const output = renderSelectPrompt(
      baseSelectState({ state: "cancel" }),
      "Token permissions",
      false
    );

    expect(output).toContain("DNS Read");
  });

  test("renders disabled option with inactive radio styling", () => {
    const output = renderSelectPrompt(
      baseSelectState(),
      "Token permissions",
      false
    );

    expect(output).toContain("DNS Write");
  });

  test("includes guide rail footer when withGuide is enabled", () => {
    withGuide = true;

    const output = renderSelectPrompt(
      baseSelectState(),
      "Token permissions",
      false
    );

    expect(output.split("\n").length).toBeGreaterThan(3);
  });
});

describe("renderTextPrompt", () => {
  test("active state shows input cursor line and confirm hint", () => {
    const output = renderTextPrompt(baseTextState(), "Token name", true);

    expect(output).toContain("Token name");
    expect(output).toContain("create-cf-token|");
    expect(output).toContain("go back");
    expect(output).toContain("confirm");
  });

  test("error state shows validation message", () => {
    const output = renderTextPrompt(
      baseTextState({
        error: "Name is required",
        state: "error",
        userInput: "",
        userInputWithCursor: "",
      }),
      "Token name",
      false
    );

    expect(output).toContain("Name is required");
  });

  test("submit state shows dimmed final input", () => {
    const output = renderTextPrompt(
      baseTextState({ state: "submit" }),
      "Token name",
      false
    );

    expect(output).toContain("create-cf-token");
  });

  test("cancel state strikes through input", () => {
    const output = renderTextPrompt(
      baseTextState({ state: "cancel" }),
      "Token name",
      false
    );

    expect(output).toContain("create-cf-token");
  });

  test("includes guide rail footer when withGuide is enabled", () => {
    withGuide = true;

    const output = renderTextPrompt(baseTextState(), "Token name", false);

    expect(output.split("\n").length).toBeGreaterThan(2);
  });
});
