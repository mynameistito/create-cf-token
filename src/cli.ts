export { run } from "@/cli/run.ts";

if (import.meta.main) {
  const { run } = await import("@/cli/run.ts");
  await run();
}
