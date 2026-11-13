import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clients = new Map([
  ["claude", ".claude"],
  ["codex", ".agents"],
  ["copilot", ".github"],
]);
const npmCli = process.platform === "win32"
  ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  : "npm";

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.error || result.stdout}`);
  }
  return result.stdout;
}

const scratchRoot = mkdtempSync(path.join(os.tmpdir(), "qa-harness-pack-smoke-"));
try {
  const packDirectory = path.join(scratchRoot, "pack");
  mkdirSync(packDirectory);
  const [packed] = JSON.parse(run(process.platform === "win32" ? process.execPath : npmCli,
    process.platform === "win32"
      ? [npmCli, "pack", "--json", "--pack-destination", packDirectory]
      : ["pack", "--json", "--pack-destination", packDirectory],
    repoRoot));
  assert.ok(packed?.filename, "npm pack did not report a tarball");
  const tarball = path.join(packDirectory, packed.filename);

  for (const [client, folder] of clients) {
    const consumerRoot = path.join(scratchRoot, client);
    mkdirSync(consumerRoot);
    run(process.platform === "win32" ? process.execPath : npmCli,
      process.platform === "win32"
        ? [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball]
        : ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball],
      consumerRoot);

    const packageRoot = path.join(consumerRoot, "node_modules", "qa-investigation-harness");
    const cli = path.join(packageRoot, "bin", "qa-investigation-harness.mjs");
    const baseline = JSON.parse(readFileSync(path.join(packageRoot, "bin", "upgrade-baselines", "0.1.0.json"), "utf8"));
    assert.equal(baseline.version, "0.1.0", "packed installer should include the legacy 0.1.0 baseline");
    run(process.execPath, [cli, "install", "--client", client], consumerRoot);

    const skillsRoot = path.join(consumerRoot, folder, "skills");
    const skillFiles = readdirSync(skillsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(path.join(skillsRoot, entry.name, "SKILL.md")));
    assert.equal(skillFiles.length, 10, `${client} install should include all 10 skills`);

    const state = JSON.parse(readFileSync(path.join(consumerRoot, ".qa-investigation-harness", "installer-state.json"), "utf8"));
    assert.equal(state.packageVersion, packed.version, `${client} install should record the package version`);
    assert.ok(state.files[`qa-harness/RULES.md`], `${client} install should track shared files`);
    assert.ok(state.files[`${folder}/skills/qa/SKILL.md`], `${client} install should track selected-client skills`);
    const upgrade = run(process.execPath, [cli, "upgrade", "--client", client], consumerRoot);
    assert.match(upgrade, /0 conflicts/);

    run(process.execPath, [
      path.join(consumerRoot, "qa-harness", "checks", "qa-check.mjs"),
      "--root",
      path.join(consumerRoot, "qa-harness", "fixtures", "checks"),
    ], consumerRoot);
    process.stdout.write(`${client}: packed install and rerun recorded ${skillFiles.length} skills; bundled checker ran against fixture.\n`);
  }
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}
