/// <reference types="bun-types" />

import { afterEach, describe, expect, mock, test } from "bun:test";

import { createToken, deleteToken } from "../src/api.ts";
import {
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "../src/errors.ts";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(response: Response): void {
  globalThis.fetch = mock(
    (..._args: Parameters<typeof fetch>): ReturnType<typeof fetch> =>
      Promise.resolve(response)
  ) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("createToken", () => {
  test("treats non-JSON error responses as token creation failures", async () => {
    mockFetch(
      new Response("upstream gateway error", {
        status: 502,
        statusText: "Bad Gateway",
      })
    );

    const result = await createToken("test", [], "user@example.com", "api-key");

    if (result.isOk()) {
      throw new Error(
        "Expected token creation to fail for non-JSON responses."
      );
    }

    expect(result.error).toBeInstanceOf(TokenCreationError);
  });

  test("falls back to raw response text when structured messages miss the permission name", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          detail:
            'A selected permission cannot be granted (Permission group: "DNS Write")',
          errors: [{ message: "request validation failed" }],
          success: false,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
          statusText: "Bad Request",
        }
      )
    );

    const result = await createToken("test", [], "user@example.com", "api-key");

    if (result.isOk()) {
      throw new Error(
        "Expected restricted permission detection to fail token creation."
      );
    }

    expect(result.error).toBeInstanceOf(RestrictedPermissionError);
    expect(
      result.error instanceof RestrictedPermissionError
        ? result.error.permissionName
        : null
    ).toBe("DNS Write");
  });
});

describe("deleteToken", () => {
  test("treats non-JSON error responses as token deletion failures", async () => {
    mockFetch(
      new Response("upstream gateway error", {
        status: 502,
        statusText: "Bad Gateway",
      })
    );

    const result = await deleteToken("token-id", "user@example.com", "api-key");

    if (result.isOk()) {
      throw new Error(
        "Expected token deletion to fail for non-JSON responses."
      );
    }

    expect(result.error).toBeInstanceOf(TokenDeletionError);
  });
});
