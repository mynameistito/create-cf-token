/**
 * CLI argument parser and non-interactive validation for create-cf-token.
 *
 * @module cli/args
 */

/** Discovery and automation output format. */
export type OutputFormat = "json" | "table";

type OutputMode = "json" | "text";

/** Parsed CLI state after argv processing. */
export interface CliArgs {
  accounts?: string;
  command:
    | "create"
    | "help"
    | "help-automation"
    | "interactive"
    | "list-accounts"
    | "list-permissions"
    | "list-scopes"
    | "skill"
    | "version";
  dryRun: boolean;
  /** Set when `-n` / `--non-interactive` is passed explicitly (not env-only). */
  explicitNonInteractive: boolean;
  file?: string;
  format: OutputFormat;
  name?: string;
  nonInteractive: boolean;
  output?: OutputMode;
  preset?: "full-access";
  scopes?: string;
  yes: boolean;
}

/** Parse failure with a single human-readable message. */
export interface CliParseError {
  error: string;
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function takeValue(argv: string[], index: number): string | undefined {
  const next = argv[index + 1];
  if (next === undefined) {
    return undefined;
  }
  if (next.startsWith("-") && next !== "-") {
    return undefined;
  }
  return next;
}

interface ParseState {
  accounts?: string;
  command: CliArgs["command"];
  dryRun: boolean;
  explicitNonInteractive: boolean;
  file?: string;
  format: OutputFormat;
  name?: string;
  nonInteractive: boolean;
  output?: OutputMode;
  preset?: CliArgs["preset"];
  scopes?: string;
  yes: boolean;
}

type ArgParseResult =
  | { advance?: number; kind: "ok" }
  | { error: string; kind: "error" };

function createInitialState(): ParseState {
  return {
    command: "interactive",
    dryRun: false,
    explicitNonInteractive: false,
    format: process.stdin.isTTY === true ? "table" : "json",
    nonInteractive: isTruthyEnv(process.env.CREATE_CF_TOKEN_NON_INTERACTIVE),
    yes: false,
  };
}

function parseHelpArg(
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  const topic = takeValue(argv, index);
  if (topic === "automation") {
    state.command = "help-automation";
    return { advance: 1, kind: "ok" };
  }
  if (topic === "skill") {
    state.command = "skill";
    return { advance: 1, kind: "ok" };
  }
  state.command = "help";
  return { kind: "ok" };
}

function parseRequiredValueArg(
  flag: string,
  argv: string[],
  index: number,
  assign: (value: string) => void
): ArgParseResult {
  const value = takeValue(argv, index);
  if (!value) {
    return { error: `Missing value for ${flag}`, kind: "error" };
  }
  assign(value);
  return { advance: 1, kind: "ok" };
}

function parseFormatArg(
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  const formatValue = takeValue(argv, index);
  if (formatValue !== "json" && formatValue !== "table") {
    return {
      error: "Missing or invalid value for --format (expected json or table)",
      kind: "error",
    };
  }
  state.format = formatValue;
  return { advance: 1, kind: "ok" };
}

function parsePresetArg(
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  const value = takeValue(argv, index);
  if (value !== "full-access") {
    return {
      error: 'Missing or invalid value for --preset (expected "full-access")',
      kind: "error",
    };
  }
  state.preset = "full-access";
  return { advance: 1, kind: "ok" };
}

function parseOutputArg(
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  const value = takeValue(argv, index);
  if (value !== "json" && value !== "text") {
    return {
      error: "Missing or invalid value for --output (expected json or text)",
      kind: "error",
    };
  }
  state.output = value;
  return { advance: 1, kind: "ok" };
}

function parseFileArg(
  arg: string,
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  const value = takeValue(argv, index);
  if (!value) {
    return { error: `Missing value for ${arg}`, kind: "error" };
  }
  state.file = value;
  state.command = "create";
  return { advance: 1, kind: "ok" };
}

function parseMetaArg(
  arg: string,
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult | null {
  if (arg === "--help" || arg === "-h") {
    return parseHelpArg(argv, index, state);
  }
  if (arg === "--version" || arg === "-v") {
    state.command = "version";
    return { kind: "ok" };
  }
  if (arg === "--skill") {
    state.command = "skill";
    return { kind: "ok" };
  }
  if (arg === "--non-interactive" || arg === "-n") {
    state.nonInteractive = true;
    state.explicitNonInteractive = true;
    return { kind: "ok" };
  }
  if (arg === "--dry-run") {
    state.dryRun = true;
    return { kind: "ok" };
  }
  if (arg === "--yes" || arg === "-y") {
    state.yes = true;
    return { kind: "ok" };
  }
  if (arg === "--json") {
    state.format = "json";
    return { kind: "ok" };
  }
  if (arg === "create") {
    state.command = "create";
    return { kind: "ok" };
  }
  return null;
}

const DISCOVERY_COMMANDS: Record<string, CliArgs["command"]> = {
  "--list-accounts": "list-accounts",
  "--list-permissions": "list-permissions",
  "--list-scopes": "list-scopes",
};

function parseDiscoveryArg(
  arg: string,
  state: ParseState
): ArgParseResult | null {
  const command = DISCOVERY_COMMANDS[arg];
  if (!command) {
    return null;
  }
  state.command = command;
  return { kind: "ok" };
}

function parseValueFlagArg(
  arg: string,
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult | null {
  if (arg === "--format") {
    return parseFormatArg(argv, index, state);
  }
  if (arg === "--name") {
    return parseRequiredValueArg(arg, argv, index, (value) => {
      state.name = value;
    });
  }
  if (arg === "--preset") {
    return parsePresetArg(argv, index, state);
  }
  if (arg === "--accounts") {
    return parseRequiredValueArg(arg, argv, index, (value) => {
      state.accounts = value;
    });
  }
  if (arg === "--scopes") {
    return parseRequiredValueArg(arg, argv, index, (value) => {
      state.scopes = value;
    });
  }
  if (arg === "--output") {
    return parseOutputArg(argv, index, state);
  }
  if (arg === "--file" || arg === "-f") {
    return parseFileArg(arg, argv, index, state);
  }
  return null;
}

function parseArg(
  arg: string,
  argv: string[],
  index: number,
  state: ParseState
): ArgParseResult {
  return (
    parseMetaArg(arg, argv, index, state) ??
    parseDiscoveryArg(arg, state) ??
    parseValueFlagArg(arg, argv, index, state) ?? {
      error: `Unknown argument: ${arg}`,
      kind: "error",
    }
  );
}

function finalizeCommand(state: ParseState): void {
  if (state.explicitNonInteractive && state.command === "interactive") {
    state.command = "create";
    return;
  }
  if (
    state.nonInteractive &&
    state.command === "interactive" &&
    (state.name ||
      state.preset ||
      state.accounts ||
      state.scopes ||
      state.file ||
      state.dryRun)
  ) {
    state.command = "create";
  }
}

/**
 * Parse an argv slice into structured CLI arguments.
 *
 * Defaults to interactive mode; infers `create` when non-interactive flags or env are set.
 * Discovery commands (`--list-scopes`, etc.) and meta flags (`--help`, `--version`) are
 * resolved to explicit `command` values.
 *
 * @param argv - Arguments after the node/bun script path (typically `process.argv.slice(2)`).
 * @returns Parsed args, or {@link CliParseError} when an unknown flag or missing value is encountered.
 */
export function parseCliArgs(argv: string[]): CliArgs | CliParseError {
  const state = createInitialState();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }
    const result = parseArg(arg, argv, index, state);
    if (result.kind === "error") {
      return { error: result.error };
    }
    if (result.advance) {
      index += result.advance;
    }
  }

  finalizeCommand(state);

  return {
    accounts: state.accounts,
    command: state.command,
    dryRun: state.dryRun,
    explicitNonInteractive: state.explicitNonInteractive,
    file: state.file,
    format: state.format,
    name: state.name,
    nonInteractive: state.nonInteractive,
    output: state.output,
    preset: state.preset,
    scopes: state.scopes,
    yes: state.yes,
  };
}

/**
 * Validate that non-interactive create args include a complete token spec.
 *
 * @param args - Parsed CLI arguments.
 * @returns An error message when required fields are missing; `null` when the spec is complete.
 */
export function validateNonInteractiveSpec(args: CliArgs): string | null {
  if (args.file) {
    return null;
  }

  if (!args.name) {
    return "Non-interactive mode requires --name <string> (or --file <path>).";
  }

  if (args.preset === "full-access") {
    return null;
  }

  if (!args.scopes) {
    return "Non-interactive mode requires --scopes <spec> (or --preset full-access).";
  }

  if (!args.accounts) {
    return "Non-interactive mode requires --accounts <ids|all> when using --scopes.";
  }

  return null;
}

/**
 * Whether parsed args represent a complete non-interactive token spec.
 *
 * @param args - Parsed CLI arguments.
 * @returns `true` when {@link validateNonInteractiveSpec} returns no error.
 */
export function hasCompleteTokenSpec(args: CliArgs): boolean {
  return validateNonInteractiveSpec(args) === null;
}
