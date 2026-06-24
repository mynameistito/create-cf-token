#!/usr/bin/env bun
/**
 * Keep deno.json aligned with package.json for JSR publishes:
 * - `version`
 * - runtime `dependencies` as `npm:` import map entries
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface PackageJson {
  version: string;
  dependencies?: Record<string, string>;
}

interface DenoJson {
  version?: string;
  imports?: Record<string, string>;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const denoJsonPath = path.join(projectRoot, "deno.json");

const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf-8")
) as PackageJson;
const denoJson = JSON.parse(readFileSync(denoJsonPath, "utf-8")) as DenoJson;

const pathImports: Record<string, string> = {};
for (const [key, value] of Object.entries(denoJson.imports ?? {})) {
  if (!value.startsWith("npm:")) {
    pathImports[key] = value;
  }
}

const npmImports = Object.fromEntries(
  Object.entries(packageJson.dependencies ?? {})
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, version]) => [name, `npm:${name}@${version}`])
);

const nextImports = { ...pathImports, ...npmImports };
const importsChanged =
  JSON.stringify(denoJson.imports ?? {}) !== JSON.stringify(nextImports);
const versionChanged = denoJson.version !== packageJson.version;

if (!importsChanged && !versionChanged) {
  console.log("deno.json already in sync with package.json");
  process.exit(0);
}

if (versionChanged) {
  denoJson.version = packageJson.version;
  console.log(`Synced deno.json version to ${packageJson.version}`);
}

if (importsChanged) {
  denoJson.imports = nextImports;
  console.log(
    `Synced deno.json npm imports from package.json dependencies (${Object.keys(npmImports).length})`
  );
}

writeFileSync(denoJsonPath, `${JSON.stringify(denoJson, null, 2)}\n`);
