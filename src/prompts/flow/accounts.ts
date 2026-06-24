import { searchMultiselect } from "#src/prompts/primitives/search-multiselect.ts";
import type { Account } from "#src/types.ts";

/**
 * Prompt the user to select one or more Cloudflare accounts from the given list.
 *
 * @param accounts - Accounts fetched from the Cloudflare API.
 * @returns The accounts the user selected.
 */
export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const options = accounts.map((account) => ({
    hint: account.id,
    label: account.name,
    value: account.id,
  }));
  const ids = await searchMultiselect("Select accounts", options, false);
  return accounts.filter((account) => ids.includes(account.id));
}
