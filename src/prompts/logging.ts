import { cancel, log, outro, spinner } from "@clack/prompts";

/**
 * Print a clack cancellation message and exit the process.
 *
 * @param message - The cancellation reason to display.
 */
export function cancelPrompt(message: string): void {
  cancel(message);
}

/** Thin wrapper around `@clack/prompts` log methods to avoid importing clack outside this module. */
export const logMessage = {
  error: (message: string): void => log.error(message),
  info: (message: string): void => log.info(message),
  warn: (message: string): void => log.warn(message),
};

/**
 * Display a clack outro message signalling completion.
 *
 * @param message - The outro text.
 */
export function finishOutro(message: string): void {
  outro(message);
}

/**
 * Create a new clack spinner instance for showing loading states.
 *
 * @returns A clack spinner with `start()`, `stop()`, and `message()` methods.
 */
export function createSpinner(): ReturnType<typeof spinner> {
  return spinner();
}
