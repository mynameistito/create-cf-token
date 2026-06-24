#!/usr/bin/env bun
/**
 * Generate an SBOM and create a GitHub release for the current package.json version.
 *
 * Used by `.github/workflows/release.yml`. Requires `gh`, npm, `GITHUB_SHA`, and
 * `GH_TOKEN` (or `GITHUB_TOKEN`, which `gh` also accepts).
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface PackageJson {
  name: string;
  version: string;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const changelogPath = path.join(projectRoot, "CHANGELOG.md");
const sbomPath = path.join(projectRoot, "sbom.json");
const notesPath = path.join(projectRoot, "release-notes.md");

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageJson;
}

function extractReleaseNotes(version: string): string {
  const changelog = readFileSync(changelogPath, "utf-8");
  const heading = `## ${version}`;
  const start = changelog.indexOf(heading);

  if (start === -1) {
    return `Release ${version}`;
  }

  const bodyStart = changelog.indexOf("\n", start) + 1;
  const nextHeading = changelog.indexOf("\n## ", bodyStart);

  return changelog
    .slice(bodyStart, nextHeading === -1 ? undefined : nextHeading)
    .trim();
}

function run(command: string[], options?: { captureStdout?: boolean }): string {
  const proc = Bun.spawnSync(command, {
    cwd: projectRoot,
    env: process.env,
    stderr: "inherit",
    stdout: options?.captureStdout ? "pipe" : "inherit",
  });

  if ((proc.exitCode ?? 1) !== 0) {
    process.exit(proc.exitCode ?? 1);
  }

  return options?.captureStdout ? (proc.stdout?.toString() ?? "") : "";
}

function generateSbom(): void {
  run(["npm", "install", "--package-lock-only", "--ignore-scripts"]);
  writeFileSync(
    sbomPath,
    run(["npm", "sbom", "--sbom-format", "cyclonedx", "--omit=dev"], {
      captureStdout: true,
    })
  );
}

function createGitHubRelease(): void {
  const { name, version } = readPackageJson();
  const tag = `v${version}`;
  const target = process.env.GITHUB_SHA;

  if (!target) {
    console.error("GITHUB_SHA is required");
    process.exit(1);
  }

  writeFileSync(notesPath, extractReleaseNotes(version));

  const existing = Bun.spawnSync(["gh", "release", "view", tag], {
    cwd: projectRoot,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });

  if (existing.exitCode === 0) {
    console.log(`GitHub release ${tag} already exists`);
    return;
  }

  run([
    "gh",
    "release",
    "create",
    tag,
    "--target",
    target,
    "--title",
    `${name}@${version}`,
    "--notes-file",
    notesPath,
    "--latest",
    sbomPath,
  ]);
}

generateSbom();
createGitHubRelease();
