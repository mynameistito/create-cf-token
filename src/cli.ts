import { handleFlags, main } from "./index.ts";
import { logMessage } from "./prompts.ts";

if (!handleFlags()) {
  main().catch((err: unknown) => {
    if (err instanceof Error) {
      logMessage.error(err.stack ?? err.message);
    } else {
      try {
        const stringified = JSON.stringify(err);
        logMessage.error(stringified === undefined ? String(err) : stringified);
      } catch {
        logMessage.error(String(err));
      }
    }
    process.exit(1);
  });
}
