---
"create-cf-token": minor
---

Fix CLI runtime stability and update the project linting setup for the current Ultracite Oxlint/Oxfmt toolchain.

This release fixes Cloudflare API error construction with the installed `better-result` version, prevents non-interactive CLI runs from hanging when prompts cannot read from a TTY, and restores the generated CLI shebang in the built `dist/cli.mjs` output.

It also updates tests and source formatting to satisfy the current Ultracite ruleset, including Unicode-aware regular expressions, sorted object keys, async subprocess handling, and deterministic E2E behavior for Bun and Node subprocess tests.
