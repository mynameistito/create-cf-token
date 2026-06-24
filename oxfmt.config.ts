import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Assembled by changesets from .changeset/*.md; nested markdown fails oxfmt
  // rules that do not apply to the source changeset files (see PR #103).
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), "CHANGELOG.md"],
});
