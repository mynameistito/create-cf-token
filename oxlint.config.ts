import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  rules: {
    "eslint/func-style": [
      "error",
      "declaration",
      { allowArrowFunctions: true },
    ],
  },
});
