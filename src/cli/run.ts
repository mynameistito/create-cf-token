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

/**
 * Run the CLI. Checks for help/version flags first; if none are found,
 * starts the interactive token creation flow.
 */
export async function run(): Promise<void> {
  try {
    if (handleFlags()) {
      return;
    }
    if (await handleSkillFlag()) {
      return;
    }
    if (await runAutomationIfNeeded()) {
      return;
    }
    await main();
  } catch (error) {
    handleCliError(error);
  }
}
