import { describe, expect, test } from "bun:test";
import { CloudflareApiError } from "#src/errors.ts";

describe("CloudflareApiError", () => {
  test.concurrent("sets _tag to CloudflareApiError", () => {
    const err = new CloudflareApiError({
      path: "/user",
      messages: ["Unauthorized"],
    });
    expect(err._tag).toBe("CloudflareApiError");
  });

  test.concurrent("constructs message from path and messages", () => {
    const err = new CloudflareApiError({
      path: "/user",
      messages: ["Unauthorized", "Invalid key"],
    });
    expect(err.message).toBe("CF API error (/user): Unauthorized, Invalid key");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new CloudflareApiError({ path: "/user", messages: [] });
    expect(CloudflareApiError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    const err = new Error("other");
    expect(CloudflareApiError.is(err)).toBe(false);
  });

  test.concurrent("exposes path and messages fields", () => {
    const err = new CloudflareApiError({
      path: "/accounts",
      messages: ["Err1"],
    });
    expect(err.path).toBe("/accounts");
    expect(err.messages).toEqual(["Err1"]);
  });
});
