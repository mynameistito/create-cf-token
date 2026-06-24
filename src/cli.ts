import { run } from "@/cli/run.ts";

export { run };

if (import.meta.main) {
  await run();
}
