/**
 * @module cli/run
 *
 * CLI entry orchestration: flags, automation, and interactive flow.
 */

import {
  handleCliError,
  handleFlags,
  handleSkillFlag,
  main,
  runAutomationIfNeeded,
} from "#src/index.ts";

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
 * Run the CLI. Checks for help/version flags first; if none are found,
 * starts the interactive token creation flow.
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
