import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";
import { text as streamText } from "node:stream/consumers";
import { fileURLToPath } from "node:url";

export interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type SpawnCliFn = (
  args: string[],
  env?: Record<string, string>
) => Promise<SpawnResult>;

const CLI_ENTRY = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));

export const DIST_CLI = path.resolve(import.meta.dirname, "../../dist/cli.mjs");
export const distExists = existsSync(DIST_CLI);

function baseEnv(env: Record<string, string> = {}): Record<string, string> {
  return {
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
    ...env,
  };
}

export function createBunSpawnCli(): SpawnCliFn {
  return async (args, env = {}) => {
    const proc = Bun.spawn(["bun", CLI_ENTRY, ...args], {
      env: baseEnv(env),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stderr, stdout };
  };
}

export function createNodeSpawnCli(cliPath: string = DIST_CLI): SpawnCliFn {
  return async (args, env = {}) => {
    const proc = spawn("node", [cliPath, ...args], {
      env: baseEnv(env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const [stdout, stderr, closeEvent] = await Promise.all([
      streamText(proc.stdout),
      streamText(proc.stderr),
      once(proc, "close"),
    ]);
    const [exitCode] = closeEvent as [number | null, NodeJS.Signals | null];
    return {
      exitCode: exitCode ?? 1,
      stderr,
      stdout,
    };
  };
}
