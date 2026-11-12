import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

let buildCoverage;
let normalizeRelativeFile;
try {
  ({ buildCoverage, normalizeRelativeFile } = await import("./coverage-report.mjs"));
} catch {
  // The API assertion below is the intentional RED until implementation.
}

const implemented = typeof buildCoverage === "function";

async function project(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-run-coverage-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const id = "CASE-300";
  const artifactDir = path.join(root, "qa-artifacts", id);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.join(root, "specs"), { recursive: true });
  await writeFile(path.join(artifactDir, "investigation.md"), investigation());
  await writeFile(path.join(artifactDir, "flow-model.md"), `Modeled: ${options.modelDate ?? "2026-11-11"}\n`);
  await writeFile(path.join(artifactDir, "risks.md"), risks(options));
  await writeFile(path.join(root, "specs", `${id}.plan.md`), plan(options));
  if (options.createMappedFile !== false) {
    await mkdir(path.join(root, "tests"), { recursive: true });
    await writeFile(path.join(root, "tests", "filter.spec.ts"), "Synthetic fixture marker; no executable test source.\n");
  }
  if (options.validation) await writeFile(path.join(artifactDir, "validation.md"), options.validation);
  return { root, artifactDir, id };
}

function investigation() {
  return `# Investigation: Filter tasks
Format version: 1
Local ID: CASE-300
Captured: 2026-11-11

## Sources
| ID | Kind | Locator | Captured | Revision or digest | External identity |
|---|---|---|---|---|---|
| S1 | Markdown | case.md#filter | 2026-11-11 | revision-1 | none |

## Cases and requirements
| ID | Kind | Title or claim | Source ID | Location | Revision |
|---|---|---|---|---|---|
| C1 | requirement | Filter tasks | S1 | heading: Filter | 1 |

## Missing inputs
- none

## Run evidence
| ID | Source ID | Test/run reference | Observed result | Environment | Code revision |
|---|---|---|---|---|---|

## Conflicting claims
- none

## Import history
| Source ID | Source revision | Mapping revision | Case IDs | Result |
|---|---|---|---|---|
| S1 | revision-1 | map-1 | C1 | imported |
`;
}

function risks(options = {}) {
  const requirementColumn = options.requirementReference === false ? "" : "Requirement IDs";
  const headers = ["ID", "Step/State", "Risk", "Proposed oracle", "Observable", "Status", ...(requirementColumn ? [requirementColumn] : [])];
  const cells = ["R1", "Filter", "The list can be stale", "Only matching tasks are returned", "yes", "APPROVED", ...(requirementColumn ? ["C1"] : [])];
  const dependency = options.dependency ?? `flow-model.md@sha256:${createHash("sha256").update("Modeled: 2026-11-11\n").digest("hex")}`;
  const reviewed = options.reviewed ?? "Risk: The list can be stale; Oracle: Only matching tasks are returned";
  const mappedFile = options.mappedFile ?? "tests/filter.spec.ts";
  const duplicate = options.duplicateMapping ? `\n| R1 | TC-01 | ${mappedFile} |` : "";
  const extraMapping = options.extraMappingRows ?? "";
  const laterMapping = options.laterMappingSection ? `\n\n## Generated mapping (2026-11-12)\n| Risk ID | TC ID | File |\n|---|---|---|\n| R1 | TC-02 | tests/filter.spec.ts |\n` : "";
  return `# Risks: Filter tasks
Ticket: CASE-300
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ${headers.join(" | ")} |
|${headers.map(() => "---").join("|")}| 
| ${cells.join(" | ")} |

## Human decision
| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |
|---|---|---|---|---|---|
| D1 | R1 | APPROVED | 2026-11-11 | ${reviewed} | ${dependency} |

## Generated mapping (2026-11-11)
| Risk ID | TC ID | File |
|---|---|---|
| R1 | TC-01 | ${mappedFile} |${duplicate}${extraMapping}${laterMapping}
`;
}

function plan(options = {}) {
  const title = options.title ?? "Filter tasks";
  const extra = options.extraPlanTC ? `\n### TC-02: ${title}\n\n**Steps:** Filter tasks again.\n` : "";
  return `# CASE-300 - Filter tasks\n\n### TC-01: ${title}\n\n**Steps:** Filter tasks.\n\n**Expected:** Only matching tasks are returned.\n${extra}`;
}

function run(tests = [{}]) {
  return {
    metadata: { projectNames: ["chromium"], startedAt: "2026-11-11T10:00:00Z" },
    tests: tests.map((entry, order) => ({
      order,
      projectName: "chromium",
      titlePath: entry.titlePath ?? ["Filter tasks", "TC-01 Filter tasks"],
      file: entry.file ?? "tests/filter.spec.ts",
      line: entry.line ?? 12,
      column: 1,
      expectedStatus: "passed",
      status: entry.status ?? "expected",
      attempts: [],
      sourcePointer: `/suites/0/specs/${order}/tests/0`,
    })),
  };
}

test("coverage module exports the promised async builder", () => {
  assert.equal(typeof buildCoverage, "function");
});

test("links explicit requirement, decision, plan, mapped test, and run evidence", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t);
  const result = await buildCoverage(root, id, run([{}]));
  const kinds = new Map(result.links.map((link) => [link.kind, link]));

  for (const kind of ["requirement-risk", "risk-decision", "decision-plan", "plan-test", "test-run"]) {
    assert.equal(kinds.get(kind).status, "linked", `${kind} should be linked`);
    assert.ok(kinds.get(kind).sourceLocator);
  }
  assert.equal(kinds.get("risk-decision").freshness, "fresh");
  assert.equal(kinds.get("requirement-risk").fromId, "C1");
  assert.equal(kinds.get("requirement-risk").toId, "R1");
  assert.equal(kinds.get("risk-decision").toId, "D1");
  assert.equal(kinds.get("decision-plan").toId, "TC-01");
  assert.equal(kinds.get("test-run").conformance, "not-reviewed");
  assert.deepEqual(result.orphanTests, []);
});

test("matches by normalized file and exact full title path when there is no TC token", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { title: "Filters › Task list › Filter tasks" });
  const report = run([{ file: ".\\tests\\filter.spec.ts", titlePath: ["Filters", "Task list", "Filter tasks"] }]);
  const result = await buildCoverage(root, id, report);

  assert.ok(result.links.some((link) => link.kind === "test-run" && link.status === "linked"));
});

test("a matching TC token in another file is unresolved", async (t) => {
  const { root, id } = await project(t);
  const result = await buildCoverage(root, id, run([{ file: "tests/other.spec.ts" }]));
  assert.ok(!result.links.some((link) => link.kind === "test-run"));
  assert.ok(result.unresolvedMappings.some((item) => item.reason === "report file differs from mapped file"));
});

test("compares the current model and requires every dependency to be comparable", async (t) => {
  const changed = await project(t, { modelDate: "2026-11-12" });
  const partial = await project(t, { dependency: `flow-model.md@sha256:${createHash("sha256").update("Modeled: 2026-11-11\n").digest("hex")}; investigation.md@revision-0` });
  for (const [item, expected] of [[changed, "stale"], [partial, "unknown"]]) {
    const result = await buildCoverage(item.root, item.id, run());
    assert.equal(result.links.find((link) => link.kind === "risk-decision").freshness, expected);
  }
});

test("normalizes both slash styles independent of the host path flavor", () => {
  assert.equal(normalizeRelativeFile("/tmp/project", ".\\tests\\filter.spec.ts", path.posix), "tests/filter.spec.ts");
  assert.equal(normalizeRelativeFile("/tmp/project", "./tests/filter.spec.ts", path.posix), "tests/filter.spec.ts");
});

test("keeps duplicate mappings and dangling TC tokens unresolved and reports unrelated tests as orphans", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { duplicateMapping: true });
  const report = run([
    {},
    { titlePath: ["Other suite", "Unrelated test"], file: "tests/other.spec.ts" },
    { titlePath: ["Other suite", "TC-404 Unknown case"], file: "tests/other.spec.ts" },
  ]);
  const result = await buildCoverage(root, id, report);

  assert.ok(result.unresolvedMappings.some((item) => item.reason === "multiple mapping targets"));
  assert.ok(result.unresolvedMappings.some((item) => item.reason === "unknown TC ID"));
  assert.equal(result.orphanTests.length, 1);
  assert.ok(result.unresolvedMappings.some((item) => item.tcId === "TC-404"));
});

test("does not link one report test to multiple distinct TC mappings", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { extraMappingRows: "\n| R1 | TC-02 | tests/filter.spec.ts |", extraPlanTC: true, title: "Filters › Task list › Filter tasks" });
  const report = run([{ titlePath: ["Filters", "Task list", "Filter tasks"] }]);
  const result = await buildCoverage(root, id, report);

  assert.equal(result.links.filter((link) => link.kind === "test-run").length, 0);
  assert.ok(result.unresolvedMappings.some((item) => item.reason === "one report test matches multiple mappings"));
});

test("does not silently drop dangling TC tokens from a mixed title", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t);
  const result = await buildCoverage(root, id, run([{ titlePath: ["TC-01 Filter tasks TC-404"] }]));

  assert.equal(result.links.filter((link) => link.kind === "test-run").length, 0);
  assert.ok(result.unresolvedMappings.some((item) => item.tcId === "TC-404" && item.reason === "unknown TC ID"));
});

test("reads mapping rows from later dated mapping sections", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { laterMappingSection: true, extraPlanTC: true });
  const result = await buildCoverage(root, id, run([{ titlePath: ["Filters", "Task list", "TC-02 Filter tasks"] }]));

  assert.ok(result.links.some((link) => link.kind === "plan-test" && link.fromId === "TC-02"));
});

test("distinguishes missing test files from missing execution evidence", { skip: !implemented }, async (t) => {
  const absent = await project(t, { createMappedFile: false });
  const absentResult = await buildCoverage(absent.root, absent.id, run());
  assert.ok(absentResult.gaps.some((gap) => gap.status === "missing test"));

  const present = await project(t);
  const presentResult = await buildCoverage(present.root, present.id, run([]));
  assert.ok(presentResult.gaps.some((gap) => gap.status === "missing execution evidence"));
});

test("surfaces stale approval dependencies and leaves uncomparable freshness unknown", { skip: !implemented }, async (t) => {
  const stale = await project(t, { dependency: "flow-model.md@2026-11-10" });
  const staleResult = await buildCoverage(stale.root, stale.id, run());
  assert.ok(staleResult.links.some((link) => link.kind === "risk-decision" && link.status === "stale"));

  const unknown = await project(t, { dependency: "unversioned dependency" });
  const unknownResult = await buildCoverage(unknown.root, unknown.id, run());
  assert.ok(unknownResult.links.some((link) => link.kind === "risk-decision" && link.status === "unknown"));
});

test("marks an approval stale when its recorded oracle differs from the current oracle", { skip: !implemented }, async (t) => {
  const stale = await project(t, { reviewed: "R1 revision 1; Oracle: The old result is accepted" });
  const result = await buildCoverage(stale.root, stale.id, run([{}]));

  assert.ok(result.links.some((link) => link.kind === "risk-decision" && link.status === "stale"));
});

test("reports plan entries that have no generated mapping", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { extraPlanTC: true });
  const result = await buildCoverage(root, id, run([{}]));

  assert.ok(result.gaps.some((gap) => gap.status === "missing link" && gap.fromId === "TC-02"));
});

test("uses only an explicit TC-keyed human conformance record", { skip: !implemented }, async (t) => {
  const stage = await readFile(new URL("../stages/05-validate.md", import.meta.url), "utf8");
  const header = stage.match(/^\| TC ID \|[^\r\n]+$/m)?.[0];
  assert.ok(header, "Stage 5 must specify a TC-keyed validation table");
  const validation = `# Validation\n\n${header}\n|---|---|---|---|\n| TC-01 | weak | Toast only; does not verify persisted state | tests/filter.spec.ts:42 |\n`;
  const { root, id } = await project(t, { validation });
  const result = await buildCoverage(root, id, run([{}]));
  const testRun = result.links.find((link) => link.kind === "test-run");

  assert.equal(testRun.conformance, "weak");
  assert.equal(testRun.conformanceLocator, "tests/filter.spec.ts:42");
});

test("rejects investigation IDs that escape the QA artifact directory", { skip: !implemented }, async (t) => {
  const { root } = await project(t);
  await assert.rejects(() => buildCoverage(root, "../outside", run()), /investigation ID/i);
});

test("rejects mapped source paths that escape the selected project root", { skip: !implemented }, async (t) => {
  const { root, id } = await project(t, { mappedFile: "../outside/filter.spec.ts" });
  await assert.rejects(() => buildCoverage(root, id, run([{}])), /mapped source file path escapes/i);
});
