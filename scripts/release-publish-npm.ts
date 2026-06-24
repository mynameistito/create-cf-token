#!/usr/bin/env bun
/**
 * Stage an npm release via OIDC trusted publishing (`npm stage publish`).
 *
 * Used by `.github/workflows/release.yml`. Requires npm >= 11.15 and no
 * `registry-url` / `_authToken` in `.npmrc` (OIDC trusted publishing).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

interface PackageJson {
  name: string;
  version: string;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");

function npmEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  return env;
}

const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf-8")
) as PackageJson;
const packageSpec = `${packageJson.name}@${packageJson.version}`;

const view = Bun.spawnSync(["npm", "view", packageSpec, "version"], {
  cwd: projectRoot,
  env: npmEnv(),
  stderr: "pipe",
  stdout: "pipe",
});

if (view.exitCode === 0) {
  console.log(`${packageSpec} is already published`);
  process.exit(0);
}

const stage = Bun.spawnSync(
  ["npm", "stage", "publish", ".", "--access", "public", "--provenance"],
  {
    cwd: projectRoot,
    env: npmEnv(),
    stderr: "pipe",
    stdout: "inherit",
  }
);

const stageStderr = stage.stderr.toString();

if (stage.exitCode === 0) {
  process.exit(0);
}

if (/E409|409|already staged|already exists|duplicate/iu.test(stageStderr)) {
  console.error(`${packageSpec} is already staged for approval`);
  console.error(stageStderr);
  process.exit(0);
}

console.error(stageStderr);
process.exit(stage.exitCode ?? 1);
