import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";

const selectedJsPlugins = selectJsPlugins(["github", "sonarjs"]);

export default defineConfig({
  extends: [core, antiSlop, selectedJsPlugins],
  jsPlugins: selectedJsPlugins.jsPlugins,
  rules: {
    "eslint/func-style": [
      "error",
      "declaration",
      { allowArrowFunctions: true },
    ],
  },
  settings: jsPluginSettings,
});
