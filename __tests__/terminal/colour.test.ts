import { describe, expect, test } from "bun:test";

import colour from "#src/terminal/colour.ts";

const ESC = "\u001B";

describe("colour", () => {
  test("default export has RESET, CYAN, GREEN, DIM, WHITE keys with ESC sequences", () => {
    expect(colour).toHaveProperty("RESET");
    expect(colour).toHaveProperty("CYAN");
    expect(colour).toHaveProperty("GREEN");
    expect(colour).toHaveProperty("DIM");
    expect(colour).toHaveProperty("WHITE");

    expect(colour.RESET).toBe(`${ESC}[0m`);
    expect(colour.CYAN).toBe(`${ESC}[1m${ESC}[96m`);
    expect(colour.GREEN).toBe(`${ESC}[32m`);
    expect(colour.DIM).toBe(`${ESC}[90m`);
    expect(colour.WHITE).toBe(`${ESC}[1m${ESC}[97m`);

    for (const code of Object.values(colour)) {
      expect(code.startsWith(ESC)).toBe(true);
    }
  });
});
