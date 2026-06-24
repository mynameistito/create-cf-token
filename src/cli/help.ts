/**
 * @module cli/help
 *
 * CLI help text and agent skill output.
 */

import {
  getSkillPath,
  getReferencePath,
  readAutomationFile,
  SKILL_REFERENCE_FILES,
} from "#src/automation/paths.ts";
import colour from "#src/colour.ts";

const NAME = "create-cf-token";
const VERSION = process.env.npm_package_version ?? "0.0.0";

const HELP_TEXT = `
  ${colour.WHITE}${NAME}${colour.RESET} ${colour.DIM}v${VERSION}${colour.RESET}

  A CLI tool for creating Cloudflare API tokens with interactive, guided prompts.

  ${colour.WHITE}Usage${colour.RESET}

    ${colour.CYAN}npm create cf-token${colour.RESET}       ${colour.DIM}via npm${colour.RESET}
    ${colour.CYAN}pnpm create cf-token${colour.RESET}      ${colour.DIM}via pnpm${colour.RESET}
    ${colour.CYAN}bun create cf-token${colour.RESET}       ${colour.DIM}via bun${colour.RESET}
    ${colour.CYAN}create-cf-token -n --name ...${colour.RESET}  ${colour.DIM}non-interactive${colour.RESET}

  ${colour.WHITE}Options${colour.RESET}

    ${colour.CYAN}-h${colour.RESET}, ${colour.CYAN}--help${colour.RESET}            Show this help message
    ${colour.CYAN}-v${colour.RESET}, ${colour.CYAN}--version${colour.RESET}         Show version number

  ${colour.WHITE}Automation${colour.RESET}

    ${colour.CYAN}--help automation${colour.RESET}    Non-interactive flags and examples
    ${colour.CYAN}--skill${colour.RESET}              Full agent guide (scope discovery, recipes, API, troubleshooting)

  ${colour.WHITE}Environment Variables${colour.RESET}

    ${colour.CYAN}CF_API_TOKEN${colour.RESET}                      Scoped Cloudflare API token for authentication
    ${colour.CYAN}CREATE_CF_TOKEN_NON_INTERACTIVE${colour.RESET}   Set to 1 to enable non-interactive mode

  ${colour.DIM}https://github.com/mynameistito/create-cf-token${colour.RESET}
`;

const AUTOMATION_HELP_TEXT = `
  ${colour.WHITE}${NAME}${colour.RESET} ${colour.DIM}— automation${colour.RESET}

  Create Cloudflare API tokens without interactive prompts.

  ${colour.WHITE}Discovery${colour.RESET} ${colour.DIM}(read-only, no token created)${colour.RESET}

    ${colour.CYAN}--list-scopes${colour.RESET} [--format json|table] [--json]
    ${colour.CYAN}--list-permissions${colour.RESET} [--format json|table] [--json]
    ${colour.CYAN}--list-accounts${colour.RESET} [--format json|table] [--json]

  ${colour.WHITE}Non-interactive create${colour.RESET}

    ${colour.CYAN}-n${colour.RESET}, ${colour.CYAN}--non-interactive${colour.RESET}     Skip all prompts
    ${colour.CYAN}--name${colour.RESET} <string>             Token name ${colour.DIM}(required)${colour.RESET}
    ${colour.CYAN}--preset full-access${colour.RESET}        All accounts, all scopes at read+write
    ${colour.CYAN}--accounts${colour.RESET} <ids|all>        Comma-separated account IDs, or "all"
    ${colour.CYAN}--scopes${colour.RESET} <spec>             Declarative scope selection
    ${colour.CYAN}--output json${colour.RESET}               Emit { id, name, value } on success
    ${colour.CYAN}--dry-run${colour.RESET}                    Print resolved policies JSON, do not create
    ${colour.CYAN}--yes${colour.RESET}, ${colour.CYAN}-y${colour.RESET}                    Skip post-create prompts ${colour.DIM}(no-op in -n)${colour.RESET}

  ${colour.WHITE}Config file${colour.RESET}

    ${colour.CYAN}create --file token-spec.json${colour.RESET}
    ${colour.CYAN}create --file -${colour.RESET}               Read spec from stdin

  ${colour.WHITE}Scope spec formats${colour.RESET}

    Service + level:   ${colour.CYAN}Workers Scripts:write,Zone DNS:read${colour.RESET}
    Permission keys:   ${colour.CYAN}workers_scripts:write,zone_dns:read${colour.RESET}
    Permission names:  ${colour.CYAN}"Workers Scripts Write"${colour.RESET}

  ${colour.WHITE}Examples${colour.RESET}

    ${colour.DIM}# Full access CI token${colour.RESET}
    create-cf-token -n --preset full-access --name "ci-deploy" --output json

    ${colour.DIM}# Scoped workers token${colour.RESET}
    create-cf-token -n --name "workers-ci" --accounts abc123 \\
      --scopes "Workers Scripts:write,Workers KV Storage:read" --output json

    ${colour.DIM}# Dry-run policy review${colour.RESET}
    create-cf-token -n --dry-run --name x --accounts all --scopes "Zone DNS:read"

    ${colour.DIM}# Discover scopes as JSON${colour.RESET}
    create-cf-token --list-scopes --json

  ${colour.WHITE}Environment Variables${colour.RESET}

    ${colour.CYAN}CF_API_TOKEN${colour.RESET}                      Parent token with User Details:Read, User API Tokens:Edit, Account Settings:Read
    ${colour.CYAN}CREATE_CF_TOKEN_NON_INTERACTIVE${colour.RESET}   Set to 1 to enable non-interactive mode

  ${colour.DIM}For the complete agent guide (scope selection, recipes, troubleshooting):${colour.RESET}
    ${colour.CYAN}create-cf-token --skill${colour.RESET}
`;

/**
 * Concatenate SKILL.md and all reference files for --skill output.
 */
export async function printSkill(): Promise<void> {
  const sections: string[] = [
    "  SKILL — create-cf-token\n",
    "  === Overview ===\n",
  ];

  const skillContent = await readAutomationFile(getSkillPath());
  sections.push(skillContent.trimEnd(), "");

  const referenceSections = await Promise.all(
    SKILL_REFERENCE_FILES.map(async (reference) => {
      const content = await readAutomationFile(
        getReferencePath(reference.file)
      );
      return [`  === ${reference.title} ===\n`, content.trimEnd(), ""].join(
        "\n"
      );
    })
  );

  console.log([...sections, ...referenceSections].join("\n"));
}

export function printHelp(): void {
  console.log(HELP_TEXT);
}

export function printAutomationHelp(): void {
  console.log(AUTOMATION_HELP_TEXT);
}

export function printVersion(): void {
  console.log(VERSION);
}
