import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCoverage } from "./coverage-report.mjs";
import { buildTraceabilityMatrix, renderTraceabilityMatrix } from "./traceability-matrix.mjs";
import { parsePlaywrightReport } from "./playwright-json.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = path.join(repoRoot, "qa-harness/fixtures/run-report");
const cli = path.join(repoRoot, "qa-harness/checks/qa-run-report.mjs");

async function fixtureProject(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-matrix-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  return root;
}

test("builds a pre-run matrix and keeps a mapped case visible", async (t) => {
  const root = await fixtureProject(t);
  const coverage = await buildCoverage(root, "CASE-300", null, { includeMatrixEvidence: true });
  const matrix = buildTraceabilityMatrix(coverage);
  const row = matrix.rows.find((item) => item.case === "TC-01");

  assert.equal(matrix.selectedRun, null);
  assert.equal(row.execution, "no run selected");
  assert.match(row.decision, /APPROVED/);
  assert.match(row.mappingStatus, /stale or unknown approval/);
  assert.match(row.sources, /specs\/CASE-300\.plan\.md/);
});

test("retains individual Playwright project outcomes in a selected run", async (t) => {
  const root = await fixtureProject(t);
  const report = JSON.parse(await readFile(path.join(root, "playwright-report.json"), "utf8"));
  const run = parsePlaywrightReport(report, { source: "playwright-report.json" });
  const coverage = await buildCoverage(root, "CASE-300", run, { includeMatrixEvidence: true });
  const matrix = buildTraceabilityMatrix(coverage, { selectedRun: { runId: "run-1", target: "staging" } });
  const row = matrix.rows.find((item) => item.case === "TC-01");

  assert.match(row.execution, /chromium: expected/);
  assert.match(row.execution, /firefox: failure/);
  assert.match(row.execution, /webkit: skipped/);
});

test("renders matching Markdown and spreadsheet-safe CSV values", () => {
  const { markdown, csv } = renderTraceabilityMatrix({
    investigationId: "CASE-300",
    rows: [{ requirement: "C1", risk: "R1", decision: "approved", case: "TC-01", mappedTest: "tests/a.spec.ts", mappingStatus: "current", execution: "chromium: expected", validation: "not reviewed", sources: '=HYPERLINK("x") | line\nnext' }],
  });

  assert.match(markdown, /\\\| line next/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"Sources"/);
  assert.match(csv, /\r\n/);
});

test("matrix CLI prints Markdown without writing exports", async (t) => {
  const root = await fixtureProject(t);
  const result = spawnSync(process.execPath, [cli, "matrix", "--root", root, "--investigation", "CASE-300"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Traceability matrix: CASE-300/);
  assert.match(result.stdout, /no run selected/);
});

test("matrix CLI exports a selected run without replacing its input report", async (t) => {
  const root = await fixtureProject(t);
  const out = path.join(root, "out");
  await mkdir(out);
  const report = path.join(root, "playwright-report.json");
  const before = await readFile(report, "utf8");
  const common = ["matrix", "--root", root, "--investigation", "CASE-300", "--report", report, "--run-id", "run-1", "--target", "staging"];
  const outputs = ["--markdown-out", path.join(out, "matrix.md"), "--csv-out", path.join(out, "matrix.csv")];
  const result = spawnSync(process.execPath, [cli, ...common, ...outputs], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(out, "matrix.md"), "utf8"), /Selected run: run-1/);
  assert.match(await readFile(path.join(out, "matrix.csv"), "utf8"), /firefox: failure/);
  assert.equal(await readFile(report, "utf8"), before);

  const blocked = spawnSync(process.execPath, [cli, ...common, "--markdown-out", report, "--csv-out", path.join(out, "blocked.csv"), "--force"], { encoding: "utf8" });
  assert.equal(blocked.status, 2);
  assert.equal(await readFile(report, "utf8"), before);
});
