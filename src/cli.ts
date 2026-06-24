import { run } from "#src/cli/run.ts";

export { run };

if (import.meta.main) {
  await run();
}
