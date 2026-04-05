/**
 * ANSI escape code constants for terminal styling.
 * Used throughout the CLI for consistent coloured output.
 */
const colour = {
  /** Bold white — headings and emphasis. */
  WHITE: "\x1b[1m\x1b[97m",
  /** Bold cyan — URLs and interactive hints. */
  CYAN: "\x1b[1m\x1b[96m",
  /** Green — success indicators. */
  GREEN: "\x1b[32m",
  /** Dim gray — secondary/de-emphasised text. */
  DIM: "\x1b[90m",
  /** Reset all styles to terminal default. */
  RESET: "\x1b[0m",
} as const;

export default colour;
