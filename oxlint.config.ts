import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";

const selectedJsPlugins = selectJsPlugins(["github", "sonarjs"]);

export default defineConfig({
  extends: [core, antiSlop, selectedJsPlugins],
  jsPlugins: selectedJsPlugins.jsPlugins,
  overrides: [
    {
      // Verified false positives for Bun test.each/test.concurrent and shared registrars.
      files: [
        "__tests__/api/client.test.ts",
        "__tests__/automation/create.test.ts",
        "__tests__/automation/runner.test.ts",
        "__tests__/cli/args.test.ts",
        "__tests__/cli/flags.test.ts",
        "__tests__/cli/run.test.ts",
        "__tests__/e2e/cli-node-e2e.test.ts",
        "__tests__/index.test.ts",
        "__tests__/prompts/flow.test.ts",
        "__tests__/prompts/guards.test.ts",
        "__tests__/prompts/logging.test.ts",
        "__tests__/prompts/primitives.test.ts",
        "__tests__/terminal/note.test.ts",
      ],
      rules: { "sonarjs/no-empty-test-file": "off" },
    },
  ],
  rules: {
    // Preserve the existing lint policy for this final dependency-only release.
    "anti-slop/no-array-filter-map": "off",
    "anti-slop/require-readable-spacing": "off",
    "eslint/func-style": [
      "error",
      "declaration",
      { allowArrowFunctions: true },
    ],
    "sonarjs/no-inconsistent-returns": "off",
    "sonarjs/no-redundant-optional": "off",
    "sonarjs/no-require-or-define": "off",
    "unicorn/consistent-function-scoping": "off",
  },
  settings: jsPluginSettings,
});
