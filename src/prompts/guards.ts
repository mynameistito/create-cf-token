import { cancel, isCancel } from "@clack/prompts";

/**
 * Abort when stdin is not a TTY so clack prompts do not hang in CI or piped input.
 *
 * Prints a cancellation message via clack and exits the process with code `1`.
 */
export function exitIfNonInteractive(): void {
  if (process.stdin.isTTY !== true) {
    cancel("Cancelled.");
    process.exit(1);
  }
}

/**
 * Guard against clack cancellation. If the user pressed Ctrl+C or Escape,
 * print a cancellation message and exit the process.
 *
 * @template T - The expected value type.
 * @param value - The raw result from a clack prompt.
 * @returns The unwrapped value if not cancelled.
 * @throws {symbol} The clack cancellation symbol after printing a cancellation message.
 */
export function check<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    throw value;
  }
  return value as T;
}
