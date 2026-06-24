import { cancel, log, outro, spinner } from "@clack/prompts";

/**
 * Print a clack cancellation message without exiting the process.
 *
 * Callers typically follow up with their own exit or flow handling.
 *
 * @param message - The cancellation reason to display.
 */
export function cancelPrompt(message: string): void {
  cancel(message);
}

/**
 * Clack log helpers — keeps `@clack/prompts` imports confined to this module.
 *
 * @property {function(string): void} error - Print an error-styled message.
 * @property {function(string): void} info - Print an informational message.
 * @property {function(string): void} warn - Print a warning-styled message.
 */
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
