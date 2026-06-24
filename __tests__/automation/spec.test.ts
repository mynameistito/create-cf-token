import { describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  normalizeAccountsInput,
  parseTokenSpecJson,
  readTokenSpecFromFile,
  TokenSpecError,
} from "@/automation/spec.ts";

describe("parseTokenSpecJson", () => {
  test("parses a valid full-access spec", () => {
    const spec = parseTokenSpecJson(
      JSON.stringify({
        dryRun: true,
        name: "  ci-token  ",
        output: "json",
        preset: "full-access",
      })
    );

    expect(spec).toEqual({
      dryRun: true,
      name: "ci-token",
      output: "json",
      preset: "full-access",
    });
  });

  test("parses a valid scopes spec with accounts", () => {
    const spec = parseTokenSpecJson(
      JSON.stringify({
        accounts: ["acct-1", "acct-2"],
        name: "zone-token",
        scopes: "Zone DNS:read",
      })
    );

    expect(spec.name).toBe("zone-token");
    expect(spec.scopes).toBe("Zone DNS:read");
    expect(spec.accounts).toEqual(["acct-1", "acct-2"]);
  });

  test("trims account strings in scoped specs", () => {
    const spec = parseTokenSpecJson(
      JSON.stringify({
        accounts: "  acct-1  ",
        name: "zone-token",
        scopes: "Zone DNS:read",
      })
    );

    expect(spec.accounts).toBe("acct-1");
  });

  test("throws TokenSpecError for invalid JSON", () => {
    expect(() => parseTokenSpecJson("{not json")).toThrow(TokenSpecError);
    try {
      parseTokenSpecJson("{not json");
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe("Invalid JSON in token spec.");
      }
    }
  });

  test("throws TokenSpecError when JSON is not an object", () => {
    expect(() => parseTokenSpecJson("[]")).toThrow(TokenSpecError);

    try {
      parseTokenSpecJson("null");
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe("Token spec must be a JSON object.");
      }
    }
  });

  test("throws TokenSpecError when name is missing or empty", () => {
    expect(() => parseTokenSpecJson('{"preset":"full-access"}')).toThrow(
      TokenSpecError
    );
    expect(() =>
      parseTokenSpecJson('{"name":"   ","preset":"full-access"}')
    ).toThrow(TokenSpecError);
  });

  test("throws TokenSpecError when preset and scopes are both present", () => {
    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          name: "conflict",
          preset: "full-access",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);
  });

  test("throws TokenSpecError when scopes are provided without accounts", () => {
    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          name: "scoped",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);
  });

  test("throws TokenSpecError when preset and scopes are both missing", () => {
    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          name: "incomplete",
        })
      )
    ).toThrow(TokenSpecError);

    try {
      parseTokenSpecJson(
        JSON.stringify({
          name: "incomplete",
        })
      );
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toContain(
          'Token spec requires either "preset": "full-access" or a "scopes" string.'
        );
      }
    }
  });

  test("throws TokenSpecError for invalid field types", () => {
    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: 123,
          name: "bad-accounts",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          dryRun: "yes",
          name: "bad-dry-run",
          preset: "full-access",
        })
      )
    ).toThrow(TokenSpecError);

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          name: "bad-output",
          output: "yaml",
          preset: "full-access",
        })
      )
    ).toThrow(TokenSpecError);

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          name: "bad-preset",
          preset: "read-only",
        })
      )
    ).toThrow(TokenSpecError);

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: "acct-1",
          name: "bad-scopes",
          scopes: "",
        })
      )
    ).toThrow(TokenSpecError);
  });

  test("throws TokenSpecError for invalid accounts field edge cases", () => {
    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: [],
          name: "empty-array",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);

    try {
      parseTokenSpecJson(
        JSON.stringify({
          accounts: [],
          name: "empty-array",
          scopes: "Zone DNS:read",
        })
      );
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe(
          'Invalid "accounts" field: array must not be empty.'
        );
      }
    }

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: [123],
          name: "non-string-array",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: "   ",
          name: "empty-string",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);

    try {
      parseTokenSpecJson(
        JSON.stringify({
          accounts: "   ",
          name: "empty-string",
          scopes: "Zone DNS:read",
        })
      );
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe(
          'Invalid "accounts" field: expected a non-empty string.'
        );
      }
    }

    expect(() =>
      parseTokenSpecJson(
        JSON.stringify({
          accounts: ["acct-1", "   "],
          name: "empty-array-item",
          scopes: "Zone DNS:read",
        })
      )
    ).toThrow(TokenSpecError);

    try {
      parseTokenSpecJson(
        JSON.stringify({
          accounts: ["acct-1", "   "],
          name: "empty-array-item",
          scopes: "Zone DNS:read",
        })
      );
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe(
          'Invalid "accounts" field: array items must be non-empty strings.'
        );
      }
    }
  });
});

describe("readTokenSpecFromFile", () => {
  test("reads a valid token spec from a temp file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "create-cf-token-spec-"));
    const filePath = path.join(dir, "token-spec.json");

    try {
      await writeFile(
        filePath,
        JSON.stringify({
          name: "file-token",
          preset: "full-access",
        })
      );

      const spec = await readTokenSpecFromFile(filePath);
      expect(spec.name).toBe("file-token");
      expect(spec.preset).toBe("full-access");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  test("throws TokenSpecError when the file does not exist", async () => {
    const missingPath = path.join(
      tmpdir(),
      "create-cf-token-missing-spec.json"
    );

    await expect(readTokenSpecFromFile(missingPath)).rejects.toThrow(
      TokenSpecError
    );

    try {
      await readTokenSpecFromFile(missingPath);
    } catch (error) {
      expect(TokenSpecError.is(error)).toBe(true);
      if (TokenSpecError.is(error)) {
        expect(error.message).toBe(`Token spec file not found: ${missingPath}`);
      }
    }
  });

  test("rethrows non-ENOENT file read errors", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "create-cf-token-spec-dir-"));

    try {
      await expect(readTokenSpecFromFile(dir)).rejects.toThrow();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  test("reads token spec from stdin when path is -", async () => {
    mock.module("node:stream/consumers", () => ({
      text: () =>
        Promise.resolve(
          JSON.stringify({
            name: "stdin-token",
            preset: "full-access",
          })
        ),
    }));

    try {
      const { readTokenSpecFromFile: readFromStdin } =
        await import("@/automation/spec.ts");
      const spec = await readFromStdin("-");
      expect(spec.name).toBe("stdin-token");
      expect(spec.preset).toBe("full-access");
    } finally {
      mock.restore();
    }
  });
});

describe("normalizeAccountsInput", () => {
  test("returns undefined for missing input", () => {
    const accounts: string | string[] | undefined = undefined;
    expect(normalizeAccountsInput(accounts)).toBeUndefined();
  });

  test("returns the string unchanged", () => {
    expect(normalizeAccountsInput("acct-1,acct-2")).toBe("acct-1,acct-2");
  });

  test("joins array values with commas", () => {
    expect(normalizeAccountsInput(["acct-1", "acct-2"])).toBe("acct-1,acct-2");
  });
});
