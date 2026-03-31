#!/usr/bin/env node
import { handleFlags, main } from "./index.ts";
import { logMessage } from "./prompts.ts";

if (!handleFlags()) {
  main().catch((err: unknown) => {
    logMessage.error(String(err));
    process.exit(1);
  });
}
