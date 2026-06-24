import { cancel, isCancel } from "@clack/prompts";

/** Exit with failure instead of hanging when prompts cannot read from a terminal. */
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
 */
export function check<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}
