import { describe, expect, test } from "bun:test";

import { TokenCreationFlowError } from "#src/errors/token-creation-flow-error.ts";
import { TokenDeletionFlowError } from "#src/errors/token-deletion-flow-error.ts";

describe("TokenCreationFlowError", () => {
  test.concurrent("sets _tag to TokenCreationFlowError", () => {
    const err = new TokenCreationFlowError({ message: "flow failed" });
    expect(err._tag).toBe("TokenCreationFlowError");
  });

  test.concurrent("preserves message", () => {
    const err = new TokenCreationFlowError({
      message: "All selected permissions were restricted. Aborting.",
    });
    expect(err.message).toBe(
      "All selected permissions were restricted. Aborting."
    );
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new TokenCreationFlowError({ message: "x" });
    expect(TokenCreationFlowError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    expect(TokenCreationFlowError.is(new Error("other"))).toBe(false);
  });
});

describe("TokenDeletionFlowError", () => {
  test.concurrent("sets _tag to TokenDeletionFlowError", () => {
    const err = new TokenDeletionFlowError({ message: "delete failed" });
    expect(err._tag).toBe("TokenDeletionFlowError");
  });

  test.concurrent("preserves message", () => {
    const err = new TokenDeletionFlowError({
      message: "Error deleting token:\nnot found",
    });
    expect(err.message).toBe("Error deleting token:\nnot found");
  });

  test.concurrent(".is() returns true for matching instance", () => {
    const err = new TokenDeletionFlowError({ message: "x" });
    expect(TokenDeletionFlowError.is(err)).toBe(true);
  });

  test.concurrent(".is() returns false for non-matching instance", () => {
    expect(TokenDeletionFlowError.is(new Error("other"))).toBe(false);
  });
});
