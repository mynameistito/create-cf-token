/**
 * @module help
 *
 * CLI help text and agent skill output.
 */

import {
  getSkillPath,
  getReferencePath,
  readAutomationFile,
  SKILL_REFERENCE_FILES,
} from "#src/automation-paths.ts";
import colour from "#src/colour.ts";

const NAME = "create-cf-token";
const VERSION = process.env.npm_package_version ?? "0.0.0";

const { WHITE, CYAN, DIM, RESET } = colour;

export const HELP_TEXT = `
  ${WHITE}${NAME}${RESET} ${DIM}v${VERSION}${RESET}

  A CLI tool for creating Cloudflare API tokens with interactive, guided prompts.

  ${WHITE}Usage${RESET}

    ${CYAN}npm create cf-token${RESET}       ${DIM}via npm${RESET}
    ${CYAN}pnpm create cf-token${RESET}      ${DIM}via pnpm${RESET}
    ${CYAN}bun create cf-token${RESET}       ${DIM}via bun${RESET}
    ${CYAN}create-cf-token -n --name ...${RESET}  ${DIM}non-interactive${RESET}

  ${WHITE}Options${RESET}

    ${CYAN}-h${RESET}, ${CYAN}--help${RESET}            Show this help message
    ${CYAN}-v${RESET}, ${CYAN}--version${RESET}         Show version number

  ${WHITE}Automation${RESET}

    ${CYAN}--help automation${RESET}    Non-interactive flags and examples
    ${CYAN}--skill${RESET}              Full agent guide (scope discovery, recipes, API, troubleshooting)

  ${WHITE}Environment Variables${RESET}

    ${CYAN}CF_API_TOKEN${RESET}                      Scoped Cloudflare API token for authentication
    ${CYAN}CREATE_CF_TOKEN_NON_INTERACTIVE${RESET}   Set to 1 to enable non-interactive mode

  ${DIM}https://github.com/mynameistito/create-cf-token${RESET}
`;

export const AUTOMATION_HELP_TEXT = `
  ${WHITE}${NAME}${RESET} ${DIM}— automation${RESET}

  Create Cloudflare API tokens without interactive prompts.

  ${WHITE}Discovery${RESET} ${DIM}(read-only, no token created)${RESET}

    ${CYAN}--list-scopes${RESET} [--format json|table] [--json]
    ${CYAN}--list-permissions${RESET} [--format json|table] [--json]
    ${CYAN}--list-accounts${RESET} [--format json|table] [--json]

  ${WHITE}Non-interactive create${RESET}

    ${CYAN}-n${RESET}, ${CYAN}--non-interactive${RESET}     Skip all prompts
    ${CYAN}--name${RESET} <string>             Token name ${DIM}(required)${RESET}
    ${CYAN}--preset full-access${RESET}        All accounts, all scopes at read+write
    ${CYAN}--accounts${RESET} <ids|all>        Comma-separated account IDs, or "all"
    ${CYAN}--scopes${RESET} <spec>             Declarative scope selection
    ${CYAN}--output json${RESET}               Emit { id, name, value } on success
    ${CYAN}--dry-run${RESET}                    Print resolved policies JSON, do not create
    ${CYAN}--yes${RESET}, ${CYAN}-y${RESET}                    Skip post-create prompts ${DIM}(no-op in -n)${RESET}

  ${WHITE}Config file${RESET}

    ${CYAN}create --file token-spec.json${RESET}
    ${CYAN}create --file -${RESET}               Read spec from stdin

  ${WHITE}Scope spec formats${RESET}

    Service + level:   ${CYAN}Workers Scripts:write,Zone DNS:read${RESET}
    Permission keys:   ${CYAN}workers_scripts:write,zone_dns:read${RESET}
    Permission names:  ${CYAN}"Workers Scripts Write"${RESET}

  ${WHITE}Examples${RESET}

    ${DIM}# Full access CI token${RESET}
    create-cf-token -n --preset full-access --name "ci-deploy" --output json

    ${DIM}# Scoped workers token${RESET}
    create-cf-token -n --name "workers-ci" --accounts abc123 \\
      --scopes "Workers Scripts:write,Workers KV Storage:read" --output json

    ${DIM}# Dry-run policy review${RESET}
    create-cf-token -n --dry-run --name x --accounts all --scopes "Zone DNS:read"

    ${DIM}# Discover scopes as JSON${RESET}
    create-cf-token --list-scopes --json

  ${WHITE}Environment Variables${RESET}

    ${CYAN}CF_API_TOKEN${RESET}                      Parent token with User Details:Read, User API Tokens:Edit, Account Settings:Read
    ${CYAN}CREATE_CF_TOKEN_NON_INTERACTIVE${RESET}   Set to 1 to enable non-interactive mode

  ${DIM}For the complete agent guide (scope selection, recipes, troubleshooting):${RESET}
    ${CYAN}create-cf-token --skill${RESET}
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
