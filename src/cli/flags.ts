/**
 * CLI flag routing and early-exit handlers.
 *
 * Bridges parsed argv to help output, skill printing, discovery, and automation create.
 *
 * @module cli/flags
 */

import {
  failIfNonInteractiveIncomplete,
  runAutomationCreate,
  runDiscovery,
  shouldRunAutomation,
} from "@/automation/runner.ts";
import type { CliArgs, CliParseError } from "@/cli/args.ts";
import { parseCliArgs } from "@/cli/args.ts";
import {
  printAutomationHelp,
  printHelp,
  printSkill,
  printVersion,
} from "@/cli/help.ts";

/** Result of parsing argv — either structured args or a parse error. */
export type ParsedCli = CliArgs | CliParseError;

/**
 * Parse argv using {@link parseCliArgs}, defaulting to `process.argv.slice(2)`.
 *
 * @param argv - Arguments after the script path.
 * @returns Parsed args or a {@link CliParseError}.
 */
export function parseArgv(argv: string[] = process.argv.slice(2)): ParsedCli {
  return parseCliArgs(argv);
}

/**
 * Handle meta flags that exit immediately: help, automation help, and version.
 *
 * Parse errors print to stderr and exit with code 1. `--skill` is deferred to
 * {@link handleSkillFlag} and returns `false` here.
 *
 * @param argv - Arguments after the script path.
 * @returns `true` when a meta flag was handled (caller should not continue).
 */
export function handleFlags(argv: string[] = process.argv.slice(2)): boolean {
  const parsed = parseCliArgs(argv);

  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return true;
  }

  switch (parsed.command) {
    case "help": {
      printHelp();
      return true;
    }
    case "help-automation": {
      printAutomationHelp();
      return true;
    }
    case "skill": {
      return false;
    }
    case "version": {
      printVersion();
      return true;
    }
    default: {
      return false;
    }
  }
}

/**
 * Print the bundled agent skill when `--skill` or `--help skill` was requested.
 *
 * @param argv - Arguments after the script path.
 * @returns `true` when skill output was printed.
 */
export async function handleSkillFlag(
  argv: string[] = process.argv.slice(2)
): Promise<boolean> {
  const parsed = parseCliArgs(argv);
  if ("error" in parsed) {
    return false;
  }
  if (parsed.command === "skill") {
    await printSkill();
    return true;
  }
  return false;
}

/**
 * Run discovery or non-interactive automation when argv demands it.
 *
 * Handles `--list-scopes`, `--list-permissions`, `--list-accounts`, and `-n` create paths.
 * Validates non-interactive specs before create; exits on parse or validation failure.
 *
 * @param argv - Arguments after the script path.
 * @returns `true` when automation or discovery ran (caller should not start interactive flow).
 */
export async function runAutomationIfNeeded(
  argv: string[] = process.argv.slice(2)
): Promise<boolean> {
  const parsed = parseCliArgs(argv);

  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return true;
  }

  if (
    parsed.command === "list-scopes" ||
    parsed.command === "list-permissions" ||
    parsed.command === "list-accounts"
  ) {
    await runDiscovery(parsed);
    return true;
  }

  failIfNonInteractiveIncomplete(parsed);

  if (shouldRunAutomation(parsed)) {
    await runAutomationCreate(parsed);
    return true;
  }

  return false;
}
