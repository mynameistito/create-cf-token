/**
 * @module terminal/colour
 *
 * ANSI escape code constants for terminal styling.
 */
const colour = {
  /** Bold cyan — URLs and interactive hints. */
  CYAN: "\u001B[1m\u001B[96m",
  /** Dim gray — secondary/de-emphasised text. */
  DIM: "\u001B[90m",
  /** Green — success indicators. */
  GREEN: "\u001B[32m",
  /** Reset all styles to terminal default. */
  RESET: "\u001B[0m",
  /** Bold white — headings and emphasis. */
  WHITE: "\u001B[1m\u001B[97m",
} as const;

export default colour;
