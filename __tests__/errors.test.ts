import { describe, expect, test } from "bun:test";

import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "#src/errors.ts";

describe("CloudflareApiError", () => {
  test.concurrent("sets _tag to CloudflareApiError", () => {
    const err = new CloudflareApiError({
      messages: ["Unauthorized"],
      path: "/user",
    });
    expect(err._tag).toBe("CloudflareApiError");
  });

  test.concurrent("constructs message from path and messages", () => {
    const err = new CloudflareApiError({
      messages: ["Unauthorized", "Invalid key"],
      path: "/user",
    });
    expect(err.message).toBe("CF API error (/user): Unauthorized, Invalid key");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new CloudflareApiError({ messages: [], path: "/user" });
    expect(CloudflareApiError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    const err = new Error("other");
    expect(CloudflareApiError.is(err)).toBe(false);
  });

  test.concurrent("exposes path and messages fields", () => {
    const err = new CloudflareApiError({
      messages: ["Err1"],
      path: "/accounts",
    });
    expect(err.path).toBe("/accounts");
    expect(err.messages).toEqual(["Err1"]);
  });
});

describe("TokenCreationError", () => {
  test.concurrent("sets _tag and message from errorText", () => {
    const err = new TokenCreationError({ errorText: "rate limited" });
    expect(err._tag).toBe("TokenCreationError");
    expect(err.message).toBe("Token creation failed: rate limited");
    expect(err.errorText).toBe("rate limited");
  });
});

describe("TokenDeletionError", () => {
  test.concurrent("sets _tag and message from errorText", () => {
    const err = new TokenDeletionError({ errorText: "not found" });
    expect(err._tag).toBe("TokenDeletionError");
    expect(err.message).toBe("Token deletion failed: not found");
    expect(err.errorText).toBe("not found");
  });
});

describe("RestrictedPermissionError", () => {
  test.concurrent("sets _tag and permissionName", () => {
    const err = new RestrictedPermissionError({
      errorText: "raw",
      permissionName: "DNS Write",
    });
    expect(err._tag).toBe("RestrictedPermissionError");
    expect(err.message).toBe("Restricted permission: DNS Write");
    expect(err.permissionName).toBe("DNS Write");
  });
});
