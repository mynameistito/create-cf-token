import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";

const selectedJsPlugins = selectJsPlugins(["github", "sonarjs"]);

export default defineConfig({
  extends: [core, antiSlop, selectedJsPlugins],
  jsPlugins: selectedJsPlugins.jsPlugins,
  rules: {
    // Preserve the existing lint policy for this final dependency-only release.
    "anti-slop/no-array-filter-map": "off",
    "anti-slop/require-readable-spacing": "off",
    "eslint/func-style": [
      "error",
      "declaration",
      { allowArrowFunctions: true },
    ],
    // Bun's test.each/test.concurrent and shared E2E registrars are real tests
    // that this rule does not recognise.
    "sonarjs/no-empty-test-file": "off",
    "sonarjs/no-inconsistent-returns": "off",
    "sonarjs/no-redundant-optional": "off",
    "sonarjs/no-require-or-define": "off",
    "unicorn/consistent-function-scoping": "off",
  },
  settings: jsPluginSettings,
});
