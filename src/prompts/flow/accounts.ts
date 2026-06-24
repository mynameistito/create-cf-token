import { searchMultiselect } from "@/prompts/primitives/search-multiselect.ts";
import type { SearchMultiselect } from "@/prompts/primitives/search-multiselect.ts";
import { GO_BACK } from "@/prompts/types.ts";
import type { Backable } from "@/prompts/types.ts";
import type { Account } from "@/types/index.ts";

interface SelectAccountsDeps {
  searchMultiselect: SearchMultiselect;
}

const defaultDeps: SelectAccountsDeps = { searchMultiselect };

/**
 * Prompt the user to select one or more Cloudflare accounts from the given list.
 *
 * @param accounts - Accounts fetched from the Cloudflare API.
 * @returns The accounts the user selected.
 */
export async function selectAccounts(
  accounts: Account[],
  deps: SelectAccountsDeps = defaultDeps
): Promise<Backable<Account[]>> {
  const options = accounts.map((account) => ({
    hint: account.id,
    label: account.name,
    value: account.id,
  }));
  const ids = await deps.searchMultiselect("Select accounts", options, true);
  if (ids === GO_BACK) {
    return GO_BACK;
  }
  return accounts.filter((account) => ids.includes(account.id));
}
