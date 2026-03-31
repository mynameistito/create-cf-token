#!/usr/bin/env node
import { handleFlags, main } from "./index.ts";
import { logMessage } from "./prompts.ts";

if (!handleFlags()) {
  main().catch((err: unknown) => {
    if (err instanceof Error) {
      logMessage.error(err.stack ?? err.message);
    } else {
      try {
        logMessage.error(JSON.stringify(err));
      } catch {
        logMessage.error(String(err));
      }
    }
    process.exit(1);
  });
}
