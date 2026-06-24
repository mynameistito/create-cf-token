#!/usr/bin/env bun
/**
 * Keep deno.json "version" aligned with package.json for JSR publishes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const denoJsonPath = path.join(projectRoot, "deno.json");

const packageVersion = (
  JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string }
).version;
const denoJson = JSON.parse(readFileSync(denoJsonPath, "utf-8")) as {
  version?: string;
};

if (denoJson.version === packageVersion) {
  console.log(`deno.json version already ${packageVersion}`);
  process.exit(0);
}

denoJson.version = packageVersion;
writeFileSync(denoJsonPath, `${JSON.stringify(denoJson, null, 2)}\n`);
console.log(`Synced deno.json version to ${packageVersion}`);
