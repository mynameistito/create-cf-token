import { describe, expect, test } from "bun:test";

import {
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "@/errors/index.ts";

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
