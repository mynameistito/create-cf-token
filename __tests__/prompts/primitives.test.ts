import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { GO_BACK } from "@/prompts/types.ts";
import type { KeypressInfo, SearchOption } from "@/prompts/types.ts";

type KeyHandler = (char: string, key: KeypressInfo | undefined) => void;
type CursorHandler = (action?: string) => void;

interface MockSelectPromptInstance {
  cursor: number;
  error: string;
  options: SearchOption[];
  prompt: () => Promise<unknown>;
  simulateKey: (char: string, key: KeypressInfo | undefined) => void;
  state: "active" | "cancel" | "error" | "submit";
  value: string | undefined;
}

interface MockTextPromptInstance {
  error: string;
  prompt: () => Promise<unknown>;
  simulateKey: (char: string, key: KeypressInfo | undefined) => void;
  state: "active" | "cancel" | "error" | "submit";
  userInput: string;
  userInputWithCursor: string;
}

let keySimulation: ((prompt: MockAutocompletePrompt) => void) | undefined;
let selectKeySimulation:
  | ((prompt: MockSelectPromptInstance) => void)
  | undefined;
let textKeySimulation: ((prompt: MockTextPromptInstance) => void) | undefined;

const actualCore = await import("@clack/core");

class MockAutocompletePrompt {
  cursor = 0;
  error = "";
  filteredOptions: SearchOption[];
  focusedValue: string | undefined;
  isNavigating = false;
  options: SearchOption[];
  selectedValues: string[] = [];
  state: "active" | "cancel" | "error" | "submit" = "active";
  userInput = "";
  userInputWithCursor = "";
  private readonly cursorHandlers: CursorHandler[] = [];
  private readonly keyHandlers: KeyHandler[] = [];
  private readonly validate?: () => string | undefined;

  constructor(config: {
    filter?: (search: string, option: SearchOption) => boolean;
    options: SearchOption[];
    render?: () => string;
    validate?: () => string | undefined;
  }) {
    this.options = config.options;
    this.filteredOptions = config.options;
    this.validate = config.validate;
    if (config.filter) {
      this.filteredOptions = config.options.filter((option) =>
        config.filter?.("", option)
      );
    }
    this.focusedValue = this.filteredOptions[0]?.value;
  }

  deselectAll(): void {
    this.selectedValues = [];
  }

  on(event: "cursor" | "key", handler: CursorHandler | KeyHandler): void {
    if (event === "cursor") {
      this.cursorHandlers.push(handler as CursorHandler);
      return;
    }
    this.keyHandlers.push(handler as KeyHandler);
  }

  simulateCursor(action?: string): void {
    for (const handler of this.cursorHandlers) {
      handler(action);
    }
  }

  simulateKey(char: string, key: KeypressInfo | undefined): void {
    for (const handler of this.keyHandlers) {
      handler(char, key);
    }
  }

  toggleSelected(value: string): void {
    if (this.selectedValues.includes(value)) {
      this.selectedValues = this.selectedValues.filter(
        (selected) => selected !== value
      );
      return;
    }
    this.selectedValues.push(value);
  }

  _clearUserInput(): void {
    this.userInput = "";
    this.userInputWithCursor = "";
  }

  prompt(): Promise<unknown> {
    keySimulation?.(this);
    if (this.state === "submit") {
      return Promise.resolve(Reflect.get(this, "value"));
    }
    const validationError = this.validate?.();
    if (validationError) {
      this.error = validationError;
      this.state = "error";
    }
    return Promise.resolve(this.selectedValues);
  }
}

function MockSelectPrompt(
  this: MockSelectPromptInstance & {
    on: (event: "key", handler: KeyHandler) => void;
  },
  config: { options: SearchOption[]; render?: () => string }
): void {
  const keyHandlers: KeyHandler[] = [];
  this.cursor = 0;
  this.error = "";
  this.options = config.options;
  this.state = "active";
  this.value = config.options[0]?.value;
  this.on = (event, handler) => {
    if (event === "key") {
      keyHandlers.push(handler);
    }
  };
  this.simulateKey = (char, key) => {
    for (const handler of keyHandlers) {
      handler(char, key);
    }
  };
  this.prompt = () => {
    selectKeySimulation?.(this);
    if (this.state === "submit") {
      return Promise.resolve(Reflect.get(this, "value"));
    }
    return Promise.resolve(this.value);
  };
}

function MockTextPrompt(
  this: MockTextPromptInstance & {
    on: (event: "key", handler: KeyHandler) => void;
  },
  config: {
    initialValue: string;
    render?: () => string;
    validate: (value: string) => string | undefined;
  }
): void {
  const keyHandlers: KeyHandler[] = [];
  this.error = "";
  this.state = "active";
  this.userInput = config.initialValue;
  this.userInputWithCursor = config.initialValue;
  this.on = (event, handler) => {
    if (event === "key") {
      keyHandlers.push(handler);
    }
  };
  this.simulateKey = (char, key) => {
    for (const handler of keyHandlers) {
      handler(char, key);
    }
  };
  this.prompt = () => {
    textKeySimulation?.(this);
    if (this.state === "submit") {
      return Promise.resolve(Reflect.get(this, "value"));
    }
    const validationError = config.validate(this.userInput);
    if (validationError) {
      this.error = validationError;
      this.state = "error";
      return Promise.resolve(this.userInput);
    }
    return Promise.resolve(this.userInput);
  };
}

mock.module("@clack/core", () => ({
  ...actualCore,
  AutocompletePrompt: MockAutocompletePrompt,
  SelectPrompt: MockSelectPrompt,
  TextPrompt: MockTextPrompt,
}));

const actualSelectWithBackModule =
  await import("@/prompts/primitives/select-with-back.ts");
const {
  createSearchMultiselect,
  shouldToggleSelectAll: realShouldToggleSelectAll,
} = await import("@/prompts/primitives/search-multiselect.ts");
const realSearchMultiselect = createSearchMultiselect(
  MockAutocompletePrompt as never
);
const { textWithBack: realTextWithBack } =
  await import("@/prompts/primitives/text-with-back.ts");

const OPTIONS: SearchOption[] = [
  { label: "Alpha", value: "alpha" },
  { label: "Beta", value: "beta" },
  { disabled: true, label: "Disabled", value: "disabled" },
];

const originalIsTTY = process.stdin.isTTY;

function setStdinTTY(isTTY: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: isTTY,
  });
}

beforeEach(() => {
  setStdinTTY(true);
  keySimulation = undefined;
  selectKeySimulation = undefined;
  textKeySimulation = undefined;
});

afterEach(() => {
  setStdinTTY(originalIsTTY);
});

describe.serial("shouldToggleSelectAll", () => {
  test.serial("Ctrl+A always toggles", () => {
    expect(realShouldToggleSelectAll({ ctrl: true, name: "a" }, false)).toBe(
      true
    );
  });

  test.serial("bare a toggles only when navigating the list", () => {
    expect(realShouldToggleSelectAll({ name: "a" }, true)).toBe(true);
    expect(realShouldToggleSelectAll({ name: "a" }, false)).toBe(false);
  });
});

describe.serial("searchMultiselect", () => {
  test.serial("returns selected values when allowBack is false", async () => {
    keySimulation = (prompt) => {
      prompt.selectedValues = ["alpha"];
    };

    const result = await realSearchMultiselect("Pick items", OPTIONS, false);

    expect(result).toEqual(["alpha"]);
  });

  test.serial("Ctrl+A selects all enabled options", async () => {
    keySimulation = (prompt) => {
      prompt.simulateKey("", { ctrl: true, name: "a" });
    };

    const result = await realSearchMultiselect("Pick items", OPTIONS, false);

    expect(result).toEqual(["alpha", "beta"]);
  });

  test.serial(
    "Ctrl+A deselects all when every enabled option is selected",
    async () => {
      keySimulation = (prompt) => {
        prompt.selectedValues = ["alpha", "beta"];
        prompt.simulateKey("", { ctrl: true, name: "a" });
      };

      const result = await realSearchMultiselect("Pick items", OPTIONS, false);

      expect(result).toEqual([]);
    }
  );

  test.serial(
    "bare a after navigation selects all and clears search",
    async () => {
      let capturedPrompt: MockAutocompletePrompt | undefined;
      keySimulation = (prompt) => {
        capturedPrompt = prompt;
        prompt.userInput = "alp";
        prompt.userInputWithCursor = "alp|";
        prompt.simulateCursor("down");
        prompt.simulateKey("a", { name: "a" });
      };

      const result = await realSearchMultiselect("Pick items", OPTIONS, false);

      expect(result).toEqual(["alpha", "beta"]);
      expect(capturedPrompt?.userInput).toBe("");
    }
  );

  test.serial(
    "returns GO_BACK on backspace with empty search when allowBack is true",
    async () => {
      keySimulation = (prompt) => {
        prompt.simulateKey("\b", { name: "backspace", sequence: "\b" });
      };

      const result = await realSearchMultiselect("Pick items", OPTIONS, true);

      expect(result).toBe(GO_BACK);
    }
  );
});

describe.serial("selectWithBack", () => {
  test.serial("returns selected value", async () => {
    selectKeySimulation = (prompt) => {
      prompt.value = "beta";
    };

    const result = await actualSelectWithBackModule.selectWithBack(
      "Choose one",
      OPTIONS
    );

    expect(result).toBe("beta");
  });

  test.serial("returns GO_BACK on backspace", async () => {
    selectKeySimulation = (prompt) => {
      prompt.simulateKey("\b", { name: "backspace", sequence: "\b" });
    };

    const result = await actualSelectWithBackModule.selectWithBack(
      "Choose one",
      OPTIONS
    );

    expect(result).toBe(GO_BACK);
  });
});

describe.serial("textWithBack", () => {
  test.serial("returns entered text", async () => {
    textKeySimulation = (prompt) => {
      prompt.userInput = "my-token";
      prompt.userInputWithCursor = "my-token";
    };

    const result = await realTextWithBack("Token name", "default-name");

    expect(result).toBe("my-token");
  });

  test.serial("returns GO_BACK on backspace when input is empty", async () => {
    textKeySimulation = (prompt) => {
      prompt.userInput = "";
      prompt.userInputWithCursor = "";
      prompt.simulateKey("\b", { name: "backspace", sequence: "\b" });
    };

    const result = await realTextWithBack("Token name", "");

    expect(result).toBe(GO_BACK);
  });
});
