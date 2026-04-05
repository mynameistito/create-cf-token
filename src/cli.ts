/**
 * @module cli
 *
 * Process entry point for the create-cf-token CLI.
 *
 * Handles CLI flags (`--help`, `--version`) and launches the main interactive
 * flow. The shebang (`#!/usr/bin/env node`) is injected at build time by
 * tsdown — do not add one here.
 */

import { handleCliError, handleFlags, main } from "#src/index.ts";

/**
 * Run the CLI. Checks for help/version flags first; if none are found,
 * starts the interactive token creation flow.
 */
export function run(): void {
  if (!handleFlags()) {
    main().catch(handleCliError);
  }
}

/* c8 ignore next 3 -- entry point guard, only reachable when cli.ts is the process entry */
if (import.meta.main) {
  run();
}
