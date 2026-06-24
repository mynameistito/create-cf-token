/**
 * CLI entry orchestration: early-exit flags, automation, skill output, interactive flow.
 *
 * @module cli/run
 */

import {
  handleCliError,
  handleFlags,
  handleSkillFlag,
  main,
  runAutomationIfNeeded,
} from "@/index.ts";

interface RunDeps {
  handleCliError: (error: unknown) => void;
  handleFlags: typeof handleFlags;
  handleSkillFlag: typeof handleSkillFlag;
  main: typeof main;
  runAutomationIfNeeded: typeof runAutomationIfNeeded;
}

const defaultDeps: RunDeps = {
  handleCliError,
  handleFlags,
  handleSkillFlag,
  main,
  runAutomationIfNeeded,
};

/**
 * Run the CLI entry pipeline.
 *
 * Order: help/version flags → `--skill` output → non-interactive automation → interactive {@link main}.
 * Uncaught errors are routed through {@link handleCliError}.
 *
 * @param deps - Optional dependency overrides (primarily for tests).
 * @returns Resolves when the selected path completes; process may exit early for flags.
 */
export async function run(deps: RunDeps = defaultDeps): Promise<void> {
  try {
    if (deps.handleFlags()) {
      return;
    }
    if (await deps.handleSkillFlag()) {
      return;
    }
    if (await deps.runAutomationIfNeeded()) {
      return;
    }
    await deps.main();
  } catch (error) {
    deps.handleCliError(error);
  }
}
