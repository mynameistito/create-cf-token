/**
 * @module cli/flags
 *
 * CLI flag parsing and early-exit handlers.
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

export type ParsedCli = CliArgs | CliParseError;

export function parseArgv(argv: string[] = process.argv.slice(2)): ParsedCli {
  return parseCliArgs(argv);
}

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

export async function handleSkillFlag(): Promise<boolean> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if ("error" in parsed) {
    return false;
  }
  if (parsed.command === "skill") {
    await printSkill();
    return true;
  }
  return false;
}

export async function runAutomationIfNeeded(
  argv: string[] = process.argv.slice(2)
): Promise<boolean> {
  const parsed = parseCliArgs(argv);

  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return true;
  }

  failIfNonInteractiveIncomplete(parsed);

  if (
    parsed.command === "list-scopes" ||
    parsed.command === "list-permissions" ||
    parsed.command === "list-accounts"
  ) {
    await runDiscovery(parsed);
    return true;
  }

  if (shouldRunAutomation(parsed)) {
    await runAutomationCreate(parsed);
    return true;
  }

  return false;
}
