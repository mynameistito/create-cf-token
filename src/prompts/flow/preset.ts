import { select } from "@clack/prompts";

import { check, exitIfNonInteractive } from "#src/prompts/guards.ts";
import type { TokenPreset } from "#src/prompts/types.ts";

/**
 * Ask whether to create a full-access token or choose accounts and scopes manually.
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
