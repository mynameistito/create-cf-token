/**
 * @module cli-args
 *
 * CLI argument parser for create-cf-token.
 */

export type OutputFormat = "json" | "table";

type OutputMode = "json" | "text";

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

/**
 * Parse `process.argv` slice into structured CLI arguments.
 *
 * @param argv - Arguments after the node/bun script path.
 */
/* oxlint-disable complexity -- each CLI flag is an independent branch */
export function parseCliArgs(argv: string[]): CliArgs | CliParseError {
  let command: CliArgs["command"] = "interactive";
  let nonInteractive = isTruthyEnv(process.env.CREATE_CF_TOKEN_NON_INTERACTIVE);
  let explicitNonInteractive = false;
  let dryRun = false;
  let yes = false;
  let format: OutputFormat = process.stdin.isTTY === true ? "table" : "json";
  let name: string | undefined;
  let preset: CliArgs["preset"];
  let accounts: string | undefined;
  let scopes: string | undefined;
  let output: OutputMode | undefined;
  let file: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      const topic = takeValue(argv, index);
      if (topic === "automation") {
        command = "help-automation";
        index += 1;
        continue;
      }
      if (topic === "skill") {
        command = "skill";
        index += 1;
        continue;
      }
      command = "help";
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      command = "version";
      continue;
    }

    if (arg === "--skill") {
      command = "skill";
      continue;
    }

    if (arg === "--non-interactive" || arg === "-n") {
      nonInteractive = true;
      explicitNonInteractive = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      yes = true;
      continue;
    }

    if (arg === "--json") {
      format = "json";
      continue;
    }

    if (arg === "--format") {
      const formatValue = takeValue(argv, index);
      if (formatValue !== "json" && formatValue !== "table") {
        return {
          error:
            "Missing or invalid value for --format (expected json or table)",
        };
      }
      format = formatValue;
      index += 1;
      continue;
    }

    if (arg === "--list-scopes") {
      command = "list-scopes";
      continue;
    }

    if (arg === "--list-permissions") {
      command = "list-permissions";
      continue;
    }

    if (arg === "--list-accounts") {
      command = "list-accounts";
      continue;
    }

    if (arg === "--name") {
      const value = takeValue(argv, index);
      if (!value) {
        return { error: "Missing value for --name" };
      }
      name = value;
      index += 1;
      continue;
    }

    if (arg === "--preset") {
      const value = takeValue(argv, index);
      if (value !== "full-access") {
        return {
          error:
            'Missing or invalid value for --preset (expected "full-access")',
        };
      }
      preset = "full-access";
      index += 1;
      continue;
    }

    if (arg === "--accounts") {
      const value = takeValue(argv, index);
      if (!value) {
        return { error: "Missing value for --accounts" };
      }
      accounts = value;
      index += 1;
      continue;
    }

    if (arg === "--scopes") {
      const value = takeValue(argv, index);
      if (!value) {
        return { error: "Missing value for --scopes" };
      }
      scopes = value;
      index += 1;
      continue;
    }

    if (arg === "--output") {
      const value = takeValue(argv, index);
      if (value !== "json" && value !== "text") {
        return {
          error:
            "Missing or invalid value for --output (expected json or text)",
        };
      }
      output = value;
      index += 1;
      continue;
    }

    if (arg === "create") {
      command = "create";
      continue;
    }

    if (arg === "--file" || arg === "-f") {
      const value = takeValue(argv, index);
      if (!value) {
        return { error: `Missing value for ${arg}` };
      }
      file = value;
      command = "create";
      index += 1;
      continue;
    }

    return { error: `Unknown argument: ${arg}` };
  }

  if (explicitNonInteractive && command === "interactive") {
    command = "create";
  } else if (
    nonInteractive &&
    command === "interactive" &&
    (name || preset || accounts || scopes || file || dryRun)
  ) {
    command = "create";
  }

  return {
    accounts,
    command,
    dryRun,
    explicitNonInteractive,
    file,
    format,
    name,
    nonInteractive,
    output,
    preset,
    scopes,
    yes,
  };
}

/* oxlint-enable complexity */

/**
 * Whether the parsed args represent a complete non-interactive token spec.
 */
export function hasCompleteTokenSpec(args: CliArgs): boolean {
  if (args.file) {
    return true;
  }

  if (!args.name) {
    return false;
  }

  if (args.preset === "full-access") {
    return true;
  }

  return Boolean(args.scopes && args.accounts);
}

/**
 * Validate non-interactive requirements and return an actionable error message.
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
