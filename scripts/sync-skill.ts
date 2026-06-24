#!/usr/bin/env bun
/**
 * Sync assets/automation/ to skill/create-cf-token/ repo mirror.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(projectRoot, "assets", "automation");
const targetDir = path.join(projectRoot, "skill", "create-cf-token");
const referencesSource = path.join(sourceDir, "references");
const referencesTarget = path.join(targetDir, "references");

if (!existsSync(sourceDir)) {
  console.error(`Source not found: ${sourceDir}`);
  process.exit(1);
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { force: true, recursive: true });
}

mkdirSync(referencesTarget, { recursive: true });
cpSync(referencesSource, referencesTarget, { recursive: true });

const skillSource = path.join(sourceDir, "skill.md");
const skillTarget = path.join(targetDir, "SKILL.md");
if (existsSync(skillSource)) {
  cpSync(skillSource, skillTarget);
}

console.log(`Synced ${sourceDir} -> ${targetDir}`);
