import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCoverage } from "./coverage-report.mjs";
import { buildTraceabilityMatrix, renderTraceabilityMatrix } from "./traceability-matrix.mjs";
import { buildGeneratorHandoff } from "./generator-handoff.mjs";
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

test("does not mark conflicting files for one TC ID as current", () => {
  const coverage = {
    investigationId: "CASE-300",
    links: [
      { kind: "risk-decision", fromId: "R1", status: "linked", freshness: "fresh" },
      { kind: "risk-decision", fromId: "R2", status: "linked", freshness: "fresh" },
      { kind: "decision-plan", fromId: "D1", status: "linked" },
      { kind: "decision-plan", fromId: "D2", status: "linked" },
    ],
    evidence: {
      risks: [
        { id: "R1", text: "first risk", requirementIds: [] },
        { id: "R2", text: "second risk", requirementIds: [] },
      ],
      decisions: [
        { id: "D1", riskId: "R1", decision: "APPROVED" },
        { id: "D2", riskId: "R2", decision: "APPROVED" },
      ],
      mappings: [
        { riskId: "R1", tcId: "TC-01", file: "tests/first.spec.ts" },
        { riskId: "R2", tcId: "TC-01", file: "tests/second.spec.ts" },
      ],
      plans: [{ tcId: "TC-01", locator: "specs/CASE-300.plan.md:3" }],
    },
  };

  const matrix = buildTraceabilityMatrix(coverage);

  assert.equal(matrix.rows.length, 2);
  assert.ok(matrix.rows.every((row) => row.mappingStatus === "ambiguous"));
});

test("blocks actual fresh approvals when the same TC maps to different files", async (t) => {
  const root = await fixtureProject(t);
  const model = "Modeled: 2026-11-11\n";
  await writeFile(path.join(root, "qa-artifacts", "CASE-300", "flow-model.md"), model);
  const revision = `flow-model.md@sha256:${createHash("sha256").update(model).digest("hex")}`;
  await writeFile(path.join(root, "qa-artifacts", "CASE-300", "risks.md"), `# Risks: conflicting fixture

| ID | Step/State | Risk | Proposed oracle | Observable | Status | Requirement IDs |
|---|---|---|---|---|---|---|
| R1 | Filter | First result can be stale | Return the matching result | yes | APPROVED | C1 |
| R2 | Filter | Second result can be stale | Return the matching result | yes | APPROVED | C1 |

## Human decisions
| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |
|---|---|---|---|---|---|
| D1 | R1 | APPROVED | 2026-11-12 | Risk: First result can be stale; Oracle: Return the matching result | ${revision} |
| D2 | R2 | APPROVED | 2026-11-12 | Risk: Second result can be stale; Oracle: Return the matching result | ${revision} |

## Generated mapping (2026-11-12)
| Risk ID | TC ID | File |
|---|---|---|
| R1 | TC-01 | tests/filter.spec.ts |
| R2 | TC-01 | tests/absent.spec.ts |
`);

  const coverage = await buildCoverage(root, "CASE-300", null, { includeMatrixEvidence: true });
  const matrix = buildTraceabilityMatrix(coverage);
  const handoff = buildGeneratorHandoff(matrix);

  assert.equal(matrix.rows.length, 2);
  assert.ok(matrix.rows.every((row) => row.mappingStatus === "ambiguous"));
  assert.match(handoff, /TC-01[\s\S]*ambiguous/);
  assert.doesNotMatch(handoff, /Copy to project's generator/);
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

function matrixActionCoverage({
  requirement = true,
  risk = true,
  decision = "APPROVED",
  freshness = "fresh",
  ambiguousDecision = false,
  mapping = true,
  runMatch = true,
  findings = [],
} = {}) {
  const links = [];
  if (risk && decision !== null) {
    links.push({ kind: "risk-decision", fromId: "R1", status: "linked", freshness });
    if (ambiguousDecision) links.push({ kind: "risk-decision", fromId: "R1", status: "linked", freshness });
  }
  if (mapping && decision !== null) links.push({ kind: "decision-plan", fromId: "D1", status: "linked" });
  if (mapping) links.push({ kind: "plan-test", fromId: "TC-01", status: "linked" });
  return {
    investigationId: "CASE-300",
    links,
    evidence: {
      requirements: requirement ? [{ id: "C1", title: "Filter requirement", locator: "investigation.md:1" }] : [],
      risks: risk ? [{ id: "R1", text: "Filter risk", requirementIds: requirement ? ["C1"] : [], locator: "risks.md:1" }] : [],
      decisions: decision === null ? [] : [{ id: "D1", riskId: "R1", decision, locator: "risks.md:5" }],
      mappings: mapping ? [{ riskId: "R1", tcId: "TC-01", file: "tests/filter.spec.ts", locator: "risks.md:10" }] : [],
      plans: mapping ? [{ tcId: "TC-01", locator: "specs/CASE-300.plan.md:3" }] : [],
      findings,
      matchedTestsByMapping: runMatch ? { 0: [{ projectName: "chromium", status: "expected" }] } : {},
      ambiguousMappingIndexes: [],
    },
  };
}

function matrixActionRow(options, selectedRun = null) {
  return buildTraceabilityMatrix(matrixActionCoverage(options), { selectedRun }).rows[0];
}

test("missing requirement risk link recommends scope review", () => {
  const row = matrixActionRow({ requirement: true, risk: false, decision: null, mapping: false });
  assert.equal(row.nextAction, "Review requirement scope; add an evidence-backed risk link only if warranted.");
});

for (const scenario of [
  { name: "absent", options: { decision: null, mapping: true } },
  { name: "stale", options: { freshness: "stale" } },
  { name: "unknown", options: { freshness: "unknown" } },
  { name: "ambiguous", options: { ambiguousDecision: true } },
]) {
  test("missing or " + scenario.name + " decision blocks mapping guidance", () => {
    const row = matrixActionRow(scenario.options, { runId: "run-1", target: "staging" });
    assert.equal(row.nextAction, "Review the risk and oracle; record or reconcile the human decision.");
  });
}

test("fresh rejected decision has no generation action", () => {
  const row = matrixActionRow({ decision: "REJECTED", mapping: false });
  assert.equal(row.nextAction, "");
});

test("missing mapping recommends plan and generated-test mapping resolution", () => {
  const row = matrixActionRow({ mapping: false });
  assert.equal(row.nextAction, "Resolve the approved risk's plan and generated-test mapping.");
});

test("no selected run recommends selecting a saved report", () => {
  const row = matrixActionRow();
  assert.equal(row.execution, "no run selected");
  assert.equal(row.nextAction, "Select a saved run report to inspect execution evidence.");
});

test("selected run without matching test result asks for a report containing the mapped test", () => {
  const row = matrixActionRow({ runMatch: false }, { runId: "run-1", target: "staging" });
  assert.equal(row.execution, "no matching result");
  assert.equal(row.nextAction, "Select or generate a report that includes this mapped test.");
});

test("missing validation recommends Stage 5 oracle review", () => {
  const row = matrixActionRow({}, { runId: "run-1", target: "staging" });
  assert.equal(row.validation, "not reviewed");
  assert.equal(row.nextAction, "Run Stage 5 validation for this mapped test against the approved oracle.");
});

test("recorded validation finding recommends reviewing cited evidence without reading its prose", () => {
  const row = matrixActionRow({
    findings: [{ tcId: "TC-01", conformance: "gap", finding: "Only toast visible", locator: "test.spec.ts:42", recordLocator: "validation.md:8" }],
  }, { runId: "run-1", target: "staging" });
  assert.equal(row.nextAction, "Review the cited Stage 5 finding; use the project's generator if a test change is warranted.");
  assert.match(row.sources, /validation\.md:8/);
});

test("only earliest unresolved action is shown", () => {
  const row = matrixActionRow({ freshness: "stale", mapping: false, runMatch: false, findings: [{ tcId: "TC-01", conformance: "gap", finding: "weak", locator: "test.spec.ts:42" }] });
  assert.equal(row.nextAction, "Review the risk and oracle; record or reconcile the human decision.");
});

test("matrix Markdown and CSV render next action", () => {
  const { markdown, csv } = renderTraceabilityMatrix({
    investigationId: "CASE-300",
    rows: [{ requirement: "C1", risk: "R1", decision: "approved", case: "TC-01", mappedTest: "tests/a.spec.ts", mappingStatus: "current", execution: "chromium: expected", validation: "not reviewed", sources: "risks.md:5", nextAction: "=HYPERLINK" }],
  });
  assert.match(markdown, /\| Next action \|/);
  assert.match(markdown, /\| =HYPERLINK \|/);
  assert.match(csv, /"Next action"/);
  assert.match(csv, /"'=HYPERLINK"/);
});

