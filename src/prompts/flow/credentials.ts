import { password } from "@clack/prompts";

import { check, exitIfNonInteractive } from "@/prompts/guards.ts";
import colour from "@/terminal/colour.ts";

function isPlaceholderToken(value: string): boolean {
  return value.startsWith("your_") || value.includes(" ");
}

/**
 * Prompt the user for their scoped Cloudflare API token.
 *
 * Checks `CF_API_TOKEN` environment variable first; if unset, shows an
 * interactive password prompt. Exits the process on cancellation.
 *
 * The token needs at minimum: User Details:Read, User API Tokens:Edit, Account Settings:Read.
 *
 * @returns An object containing the trimmed API token string.
 */
export async function askCredentials(): Promise<{ apiToken: string }> {
  const envToken = process.env.CF_API_TOKEN;
  if (!(envToken && !isPlaceholderToken(envToken))) {
    exitIfNonInteractive();
  }
  const apiToken = (
    (envToken && !isPlaceholderToken(envToken) ? envToken : undefined) ??
    check(
      await password({
        message: `${colour.WHITE}Your Cloudflare API Token:${colour.RESET}`,
        validate: (v) => (v ? undefined : "API token is required"),
      })
    )
  ).trim();

  return { apiToken };
}
