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
    const err = new TokenCreationError({ errorText: "fail" });
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

describe("TokenCreationError", () => {
  test.concurrent("sets _tag to TokenCreationError", () => {
    const err = new TokenCreationError({ errorText: "bad response" });
    expect(err._tag).toBe("TokenCreationError");
  });

  test.concurrent("constructs message from errorText", () => {
    const err = new TokenCreationError({ errorText: "bad response" });
    expect(err.message).toBe("Token creation failed: bad response");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new TokenCreationError({ errorText: "" });
    expect(TokenCreationError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    const err = new CloudflareApiError({ path: "/", messages: [] });
    expect(TokenCreationError.is(err)).toBe(false);
  });
});

describe("TokenDeletionError", () => {
  test.concurrent("sets _tag to TokenDeletionError", () => {
    const err = new TokenDeletionError({ errorText: "not found" });
    expect(err._tag).toBe("TokenDeletionError");
  });

  test.concurrent("constructs message from errorText", () => {
    const err = new TokenDeletionError({ errorText: "not found" });
    expect(err.message).toBe("Token deletion failed: not found");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new TokenDeletionError({ errorText: "" });
    expect(TokenDeletionError.is(err)).toBe(true);
  });
});

describe("RestrictedPermissionError", () => {
  test.concurrent("sets _tag to RestrictedPermissionError", () => {
    const err = new RestrictedPermissionError({
      permissionName: "DNS Write",
      errorText: "restricted",
    });
    expect(err._tag).toBe("RestrictedPermissionError");
  });

  test.concurrent("constructs message from permissionName", () => {
    const err = new RestrictedPermissionError({
      permissionName: "DNS Write",
      errorText: "",
    });
    expect(err.message).toBe("Restricted permission: DNS Write");
  });

  test.concurrent("exposes permissionName and errorText fields", () => {
    const err = new RestrictedPermissionError({
      permissionName: "Workers AI Write",
      errorText: "raw error",
    });
    expect(err.permissionName).toBe("Workers AI Write");
    expect(err.errorText).toBe("raw error");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new RestrictedPermissionError({
      permissionName: "x",
      errorText: "",
    });
    expect(RestrictedPermissionError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    const err = new TokenCreationError({ errorText: "" });
    expect(RestrictedPermissionError.is(err)).toBe(false);
  });
});
