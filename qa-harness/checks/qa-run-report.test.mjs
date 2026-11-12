import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(repoRoot, "qa-harness/checks/qa-run-report.mjs");
const fixturePath = path.join(repoRoot, "qa-harness/fixtures/run-report");

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-run-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixturePath, root, { recursive: true });
  await mkdir(path.join(root, "out"), { recursive: true });
  return {
    root,
    report: path.join(root, "playwright-report.json"),
    json: path.join(root, "out", "run.json"),
    markdown: path.join(root, "out", "run.md"),
  };
}

function argsFor(paths, overrides = {}) {
  const values = {
    "--report": paths.report,
    "--root": paths.root,
    "--investigation": "CASE-300",
    "--run-id": "run-17",
    "--target": "staging",
    "--json-out": paths.json,
    "--markdown-out": paths.markdown,
    ...overrides,
  };
  return Object.entries(values).flatMap(([flag, value]) => value === true ? [flag] : [flag, value]);
}

function invoke(argv, cwd) {
  return spawnSync(process.execPath, [cliPath, ...argv], { cwd, encoding: "utf8" });
}

test("requires run ID and target and names missing metadata flags", async (t) => {
  const paths = await workspace(t);
  const args = argsFor(paths);
  args.splice(args.indexOf("--run-id"), 2);
  const result = invoke(args, paths.root);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--run-id/);
});

test("reports malformed JSON as invalid input without producing outputs", async (t) => {
  const paths = await workspace(t);
  await writeFile(paths.report, "{ bad json");
  const result = invoke(argsFor(paths), paths.root);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /JSON/i);
  await assert.rejects(readFile(paths.json));
  await assert.rejects(readFile(paths.markdown));
});

test("writes JSON and Markdown reports and treats source failures as data", async (t) => {
  const paths = await workspace(t);
  const result = invoke(argsFor(paths, { "--revision": "abc123", "--captured-at": "2026-11-11T11:00:00Z" }), paths.root);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(paths.json, "utf8"));
  const markdown = await readFile(paths.markdown, "utf8");
  assert.equal(report.run.runId, "run-17");
  assert.equal(report.run.target, "staging");
  assert.equal(report.run.revision, "abc123");
  assert.equal(report.run.capturedAt, "2026-11-11T11:00:00Z");
  assert.equal(report.outcomeCounts.failure, 1);
  assert.match(markdown, /failure/);
});

test("writes reports while omitting an attachment path outside the project root", async (t) => {
  const paths = await workspace(t);
  const outside = path.join(path.dirname(paths.root), `outside-${path.basename(paths.root)}.zip`);
  t.after(() => rm(outside, { force: true }));
  await writeFile(outside, "synthetic outside file");
  const reportInput = JSON.parse(await readFile(paths.report, "utf8"));
  reportInput.suites[0].suites[0].specs[0].tests[0].results[0].attachments = [
    { name: "outside trace", contentType: "application/zip", path: outside, body: "must not be copied" },
  ];
  await writeFile(paths.report, JSON.stringify(reportInput));

  const result = invoke(argsFor(paths), paths.root);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(paths.json, "utf8"));
  const markdown = await readFile(paths.markdown, "utf8");
  assert.equal(report.tests[0].attempts[0].attachments[0].availability, "unavailable");
  assert.equal(report.tests[0].attempts[0].attachments[0].path, null);
  assert.equal(JSON.stringify(report).includes(outside), false);
  assert.equal(JSON.stringify(report).includes("must not be copied"), false);
  assert.equal(markdown.includes(outside), false);
});

test("preserves existing outputs unless force is set", async (t) => {
  const paths = await workspace(t);
  await writeFile(paths.json, "keep-json");
  await writeFile(paths.markdown, "keep-markdown");
  const blocked = invoke(argsFor(paths), paths.root);

  assert.equal(blocked.status, 3);
  assert.equal(await readFile(paths.json, "utf8"), "keep-json");
  assert.equal(await readFile(paths.markdown, "utf8"), "keep-markdown");

  const forced = invoke(argsFor(paths, { "--force": true }), paths.root);
  assert.equal(forced.status, 0, forced.stderr);
  assert.notEqual(await readFile(paths.json, "utf8"), "keep-json");
  assert.notEqual(await readFile(paths.markdown, "utf8"), "keep-markdown");
});

test("force cannot replace the source report", async (t) => {
  const paths = await workspace(t);
  const before = await readFile(paths.report, "utf8");
  const result = invoke(argsFor(paths, { "--json-out": paths.report, "--force": true }), paths.root);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(await readFile(paths.report, "utf8"), before);
  await assert.rejects(readFile(paths.markdown));
});

test("rejects output paths outside the selected project root", async (t) => {
  const paths = await workspace(t);
  const outside = path.join(path.dirname(paths.root), `outside-${path.basename(paths.root)}.json`);
  t.after(() => rm(outside, { force: true }));
  const result = invoke(argsFor(paths, { "--json-out": outside }), paths.root);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /inside the selected project root/i);
  await assert.rejects(readFile(outside));
});

test("rejects output aliases that resolve to the same target", async (t) => {
  const paths = await workspace(t);
  const alias = path.join(paths.root, "out-alias");
  try {
    await symlink(path.join(paths.root, "out"), alias, "junction");
  } catch (error) {
    t.skip(`Directory junction unavailable: ${error.code ?? error.message}`);
    return;
  }
  const result = invoke(argsFor(paths, {
    "--json-out": path.join(paths.root, "out", "same.json"),
    "--markdown-out": path.join(alias, "same.json"),
  }), paths.root);

  assert.equal(result.status, 2);
  await assert.rejects(readFile(path.join(paths.root, "out", "same.json")));
});
