import { select } from "@clack/prompts";

import { check, exitIfNonInteractive } from "@/prompts/guards.ts";
import type { TokenPreset } from "@/prompts/types.ts";

/**
 * Ask whether to create a full-access token or choose accounts and scopes manually.
 *
 * Exits the process on Ctrl+C or Escape via {@linkcode check}.
 *
 * @returns `"full-access"` for all accounts with every scope at read + write, or `"custom"`.
 */
export async function askTokenPreset(): Promise<TokenPreset> {
  exitIfNonInteractive();
  return check(
    await select({
      initialValue: "custom",
      message: "Token permissions",
      options: [
        { label: "Custom — choose accounts and scopes", value: "custom" },
        {
          label: "All accounts — full read/write access",
          value: "full-access",
        },
      ],
    })
  ) as TokenPreset;
}
