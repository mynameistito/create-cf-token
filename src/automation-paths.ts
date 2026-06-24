/**
 * @module automation-paths
 *
 * Resolve paths to packaged automation skill assets.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_FILENAME = "skill.md";
const REFERENCES_DIR = "references";

/** Reference files printed by --skill, in display order. */
export const SKILL_REFERENCE_FILES = [
  { file: "scope-spec.md", title: "Reference: Scope spec" },
  { file: "discovery-json.md", title: "Reference: Discovery JSON" },
  { file: "token-spec-schema.md", title: "Reference: Token spec schema" },
  { file: "recipes.md", title: "Reference: Recipes" },
  { file: "programmatic-api.md", title: "Reference: Programmatic API" },
  { file: "troubleshooting.md", title: "Reference: Troubleshooting" },
] as const;

function resolveAutomationDir(): string {
  const moduleDir = import.meta.dirname;
  const candidates = [
    path.join(moduleDir, "..", "assets", "automation"),
    path.join(moduleDir, "assets", "automation"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, SKILL_FILENAME))) {
      return candidate;
    }
  }

  return candidates[0] ?? path.join(moduleDir, "..", "assets", "automation");
}

function getAutomationDir(): string {
  return resolveAutomationDir();
}

export function getSkillPath(): string {
  return path.join(getAutomationDir(), SKILL_FILENAME);
}

export function getReferencePath(filename: string): string {
  return path.join(getAutomationDir(), REFERENCES_DIR, filename);
}

export function readAutomationFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    return Promise.reject(new Error(`Automation asset not found: ${filePath}`));
  }
  return readFile(filePath, "utf-8");
}
