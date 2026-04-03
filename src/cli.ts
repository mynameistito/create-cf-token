import { handleCliError, handleFlags, main } from "./index.ts";

export function run(): void {
  if (!handleFlags()) {
    main().catch(handleCliError);
  }
}

/* c8 ignore next 3 -- entry point guard, only reachable when cli.ts is the process entry */
if (import.meta.main) {
  run();
}
