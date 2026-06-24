import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  getReferencePath,
  getSkillPath,
  readAutomationFile,
  SKILL_REFERENCE_FILES,
} from "#src/automation/paths.ts";

describe("SKILL_REFERENCE_FILES", () => {
  test("lists six reference files in display order", () => {
    expect(SKILL_REFERENCE_FILES).toHaveLength(6);
    expect(SKILL_REFERENCE_FILES.map((entry) => entry.file)).toEqual([
      "scope-spec.md",
      "discovery-json.md",
      "token-spec-schema.md",
      "recipes.md",
      "programmatic-api.md",
      "troubleshooting.md",
    ]);
  });
});

describe("getSkillPath", () => {
  test("returns a path ending in skill.md", () => {
    const skillPath = getSkillPath();
    expect(
      skillPath.endsWith(path.join("assets", "automation", "skill.md"))
    ).toBe(true);
  });
});

describe("getReferencePath", () => {
  test("returns a path ending in references/<filename>", () => {
    const referencePath = getReferencePath("scope-spec.md");
    expect(
      referencePath.endsWith(
        path.join("assets", "automation", "references", "scope-spec.md")
      )
    ).toBe(true);
  });
});

describe("readAutomationFile", () => {
  test("reads the packaged skill.md asset from the repo", async () => {
    const content = await readAutomationFile(getSkillPath());
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("create-cf-token");
  });

  test("rejects when the automation asset does not exist", async () => {
    const missingPath = path.join(
      path.dirname(getSkillPath()),
      "missing-asset.md"
    );

    await expect(readAutomationFile(missingPath)).rejects.toThrow(
      `Automation asset not found: ${missingPath}`
    );
  });
});
