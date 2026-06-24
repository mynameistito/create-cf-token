import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";
import { text as streamText } from "node:stream/consumers";

export interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type SpawnCliFn = (
  args: string[],
  env?: Record<string, string>
) => Promise<SpawnResult>;

export const DIST_CLI = path.resolve(import.meta.dirname, "../../dist/cli.mjs");
export const distExists = existsSync(DIST_CLI);

function baseEnv(env: Record<string, string> = {}): Record<string, string> {
  return {
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
    ...env,
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
