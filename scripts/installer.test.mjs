import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliSource = path.join(repoRoot, "bin", "qa-investigation-harness.mjs");
const legacyBaseline = path.join(repoRoot, "bin", "upgrade-baselines", "0.1.0.json");
const temporaryRoots = new Set();

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "qa-harness-installer-test-"));
  temporaryRoots.add(root);
  const packageRoot = path.join(root, "package");
  const projectRoot = path.join(root, "project");
  mkdirSync(path.join(packageRoot, "bin", "upgrade-baselines"), { recursive: true });
  mkdirSync(path.join(packageRoot, "qa-harness"), { recursive: true });
  mkdirSync(path.join(packageRoot, ".agents", "skills", "qa-intake"), { recursive: true });
  mkdirSync(projectRoot);
  cpSync(cliSource, path.join(packageRoot, "bin", "qa-investigation-harness.mjs"));
  cpSync(legacyBaseline, path.join(packageRoot, "bin", "upgrade-baselines", "0.1.0.json"));
  writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ name: "qa-investigation-harness", version: "0.2.0" }));
  writeFileSync(path.join(packageRoot, "qa-harness", "RULES.md"), "current rules\n");
  writeFileSync(path.join(packageRoot, ".agents", "skills", "qa-intake", "SKILL.md"), "current intake skill\n");
  return { root, packageRoot, projectRoot };
}

function runCli(context, ...args) {
  return spawnSync(process.execPath, [
    path.join(context.packageRoot, "bin", "qa-investigation-harness.mjs"),
    ...args,
  ], { cwd: context.projectRoot, encoding: "utf8" });
}

function writeProjectFile(context, relative, contents) {
  const destination = path.join(context.projectRoot, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
  return destination;
}

function stateFor(context) {
  return JSON.parse(readFileSync(path.join(context.projectRoot, ".qa-investigation-harness", "installer-state.json"), "utf8"));
}

test.afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
  temporaryRoots.clear();
});

test("records managed file hashes on first install", () => {
  const context = fixture();
  const result = runCli(context, "install", "--client", "claude");
  assert.equal(result.status, 0, result.stderr);

  const statePath = path.join(context.projectRoot, ".qa-investigation-harness", "installer-state.json");
  assert.equal(existsSync(statePath), true, "install should record its managed files");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.packageVersion, "0.2.0");
  assert.deepEqual(state.files, {
    "qa-harness/RULES.md": { version: "0.2.0", sha256: sha256("current rules\n") },
    ".claude/skills/qa-intake/SKILL.md": { version: "0.2.0", sha256: sha256("current intake skill\n") },
  });
});

test("refuses invalid install state before writing bundle files", () => {
  const context = fixture();
  const metadataRoot = path.join(context.projectRoot, ".qa-investigation-harness");
  mkdirSync(metadataRoot);
  writeFileSync(path.join(metadataRoot, "installer-state.json"), "not json\n");

  const result = runCli(context, "install", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(context.projectRoot, "qa-harness", "RULES.md")), false);
  assert.equal(readFileSync(path.join(metadataRoot, "installer-state.json"), "utf8"), "not json\n");
});

test("refuses invalid state versions before writing bundle files", () => {
  const context = fixture();
  const metadataRoot = path.join(context.projectRoot, ".qa-investigation-harness");
  mkdirSync(metadataRoot);
  writeFileSync(path.join(metadataRoot, "installer-state.json"), JSON.stringify({ schemaVersion: 1, packageVersion: "../../outside", files: {} }));

  const result = runCli(context, "install", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(context.projectRoot, "qa-harness", "RULES.md")), false);
});

test("upgrades untouched files from the published 0.1.0 baseline", () => {
  const context = fixture();
  const oldRules = Buffer.from(readFileSync(path.join(repoRoot, "qa-harness", "RULES.md"), "utf8").replace(/\r?\n/g, "\r\n"));
  writeProjectFile(context, "qa-harness/RULES.md", oldRules);

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), "current rules\n");
  assert.equal(stateFor(context).files["qa-harness/RULES.md"].version, "0.2.0");

  const rerun = runCli(context, "upgrade", "--client", "claude");
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.match(rerun.stdout, /0 updated, 0 added/);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), "current rules\n");
});

test("preserves a locally edited file and saves the incoming upstream copy", () => {
  const context = fixture();
  const localRules = "locally edited rules\n";
  writeProjectFile(context, "qa-harness/RULES.md", localRules);

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), localRules);
  const conflictCopy = path.join(context.projectRoot, ".qa-investigation-harness", "conflicts", "0.2.0", "qa-harness", "RULES.md");
  assert.equal(existsSync(conflictCopy), true, "upstream copy should be saved for review");
  assert.equal(readFileSync(conflictCopy, "utf8"), "current rules\n");
});

test("does not overwrite an edited upstream conflict copy on rerun", () => {
  const context = fixture();
  writeProjectFile(context, "qa-harness/RULES.md", "locally edited rules\n");
  const conflictCopy = path.join(context.projectRoot, ".qa-investigation-harness", "conflicts", "0.2.0", "qa-harness", "RULES.md");
  const firstRun = runCli(context, "upgrade", "--client", "claude");
  assert.equal(existsSync(conflictCopy), true, firstRun.stderr);
  writeFileSync(conflictCopy, "review note\n");

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(conflictCopy, "utf8"), "review note\n");
});

test("preserves investigation artifacts during an upgrade", () => {
  const context = fixture();
  const artifact = "# Historical investigation\nKeep exactly\n";
  writeProjectFile(context, "qa-artifacts/QA-123/investigation.md", artifact);

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-artifacts", "QA-123", "investigation.md"), "utf8"), artifact);
  assert.equal(Object.keys(stateFor(context).files).some(relative => relative.startsWith("qa-artifacts/")), false);
});

test("accepts a resolved local file as the new baseline without rewriting it", () => {
  const context = fixture();
  const resolvedRules = "locally merged rules\n";
  writeProjectFile(context, "qa-harness/RULES.md", resolvedRules);

  const result = runCli(context, "upgrade", "--client", "claude", "--accept-local", "qa-harness/RULES.md");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), resolvedRules);
  assert.deepEqual(stateFor(context).files["qa-harness/RULES.md"], {
    version: "0.2.0",
    sha256: sha256(resolvedRules),
  });
});

test("requires an existing file for explicit local acceptance", () => {
  const context = fixture();
  const result = runCli(context, "upgrade", "--client", "claude", "--accept-local", "qa-harness/RULES.md");
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(context.projectRoot, "qa-harness", "RULES.md")), false);
});

test("preserves existing files when no known legacy baseline is available", () => {
  const context = fixture();
  const localRules = "unknown install with local changes\n";
  writeProjectFile(context, "qa-harness/RULES.md", localRules);
  rmSync(path.join(context.packageRoot, "bin", "upgrade-baselines", "0.1.0.json"));

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), localRules);
  const conflictCopy = path.join(context.projectRoot, ".qa-investigation-harness", "conflicts", "0.2.0", "qa-harness", "RULES.md");
  assert.equal(existsSync(conflictCopy), true, "upstream copy should be saved for review");
  assert.equal(readFileSync(conflictCopy, "utf8"), "current rules\n");
});

test("preserves an untracked collision and saves the new upstream file", () => {
  const context = fixture();
  writeFileSync(path.join(context.packageRoot, "qa-harness", "new-guide.md"), "new upstream guide\n");
  const localGuide = "project-owned guide\n";
  writeProjectFile(context, "qa-harness/new-guide.md", localGuide);

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "new-guide.md"), "utf8"), localGuide);
  assert.equal(readFileSync(path.join(context.projectRoot, ".qa-investigation-harness", "conflicts", "0.2.0", "qa-harness", "new-guide.md"), "utf8"), "new upstream guide\n");
});

test("keeps a file that disappeared upstream for manual review", () => {
  const context = fixture();
  const retiredFile = readFileSync(path.join(repoRoot, "qa-harness", "CONTRACT.md"));
  writeProjectFile(context, "qa-harness/CONTRACT.md", retiredFile);

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.equal(result.status, 2);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "CONTRACT.md")).equals(retiredFile), true);
  assert.match(result.stdout, /Preserved obsolete upstream file: qa-harness\/CONTRACT\.md/);
});

test("updates shared files for another client without changing installed skills", () => {
  const context = fixture();
  assert.equal(runCli(context, "install", "--client", "claude").status, 0);
  const claudeSkill = readFileSync(path.join(context.projectRoot, ".claude", "skills", "qa-intake", "SKILL.md"));
  writeFileSync(path.join(context.packageRoot, "package.json"), JSON.stringify({ name: "qa-investigation-harness", version: "0.3.0" }));
  writeFileSync(path.join(context.packageRoot, "qa-harness", "RULES.md"), "rules 0.3.0\n");
  writeFileSync(path.join(context.packageRoot, ".agents", "skills", "qa-intake", "SKILL.md"), "intake 0.3.0\n");

  const result = runCli(context, "upgrade", "--client", "copilot");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(context.projectRoot, "qa-harness", "RULES.md"), "utf8"), "rules 0.3.0\n");
  assert.equal(readFileSync(path.join(context.projectRoot, ".claude", "skills", "qa-intake", "SKILL.md")).equals(claudeSkill), true);
  assert.equal(readFileSync(path.join(context.projectRoot, ".github", "skills", "qa-intake", "SKILL.md"), "utf8"), "intake 0.3.0\n");
  assert.equal(stateFor(context).files[".claude/skills/qa-intake/SKILL.md"].version, "0.2.0");
});

test("preflights symlink destinations before writing any managed files", t => {
  const context = fixture();
  const linkTarget = path.join(context.root, "outside.md");
  writeFileSync(linkTarget, "outside target\n");
  const linkedRules = path.join(context.projectRoot, "qa-harness", "RULES.md");
  mkdirSync(path.dirname(linkedRules), { recursive: true });
  try {
    symlinkSync(linkTarget, linkedRules, "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return t.skip("symlink creation is not permitted on this host");
    throw error;
  }

  const result = runCli(context, "upgrade", "--client", "claude");
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(linkTarget, "utf8"), "outside target\n");
  assert.equal(existsSync(path.join(context.projectRoot, ".claude", "skills", "qa-intake", "SKILL.md")), false);
});
