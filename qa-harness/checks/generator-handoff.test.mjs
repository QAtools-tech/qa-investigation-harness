import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

let buildGeneratorHandoff;
try { ({ buildGeneratorHandoff } = await import("./generator-handoff.mjs")); } catch {}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(repoRoot, "qa-harness/checks/qa-run-report.mjs");
const fixture = path.join(repoRoot, "qa-harness/fixtures/run-report");

function row(overrides = {}) {
  return {
    requirement: "C1: Requirement",
    risk: "R1: Filter result could be stale",
    decision: "D1: APPROVED (fresh)",
    case: "TC-01",
    mappedTest: "tests/filter.spec.ts",
    mappingStatus: "current",
    execution: "no run selected",
    validation: "not reviewed",
    sources: "risks.md:7; specs/CASE-300.plan.md:3",
    ...overrides,
  };
}

async function fixtureProject(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-handoff-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  return root;
}

test("freshly approved mapped cases are ready, stale or unresolved rows are blocked", () => {
  assert.equal(typeof buildGeneratorHandoff, "function", "handoff builder must be exported");
  const markdown = buildGeneratorHandoff({ investigationId: "CASE-300", rows: [
    row(),
    row({ case: "TC-02", risk: "R2: stale approval", mappingStatus: "stale or unknown approval" }),
    row({ case: "TC-03", risk: "R3: unknown freshness", mappingStatus: "unknown freshness" }),
    row({ case: "TC-04", risk: "R4: rejected", decision: "D4: REJECTED", mappingStatus: "not approved" }),
    row({ case: "TC-05", risk: "R5: ambiguous", mappingStatus: "ambiguous" }),
  ] });

  assert.match(markdown, /## Ready cases[\s\S]*TC-01/);
  assert.match(markdown, /## Blocked cases[\s\S]*TC-02[\s\S]*stale or unknown approval/);
  assert.match(markdown, /TC-03[\s\S]*unknown freshness/);
  assert.match(markdown, /TC-04[\s\S]*not approved/);
  assert.match(markdown, /TC-05[\s\S]*ambiguous/);
  const instruction = markdown.split("## Copy to project's generator")[1];
  assert.match(instruction, /TC-01/);
  assert.doesNotMatch(instruction, /TC-02|TC-03|TC-04|TC-05/);
});

test("duplicate rows for the same TC and file produce one generator instruction", () => {
  assert.equal(typeof buildGeneratorHandoff, "function", "handoff builder must be exported");
  const markdown = buildGeneratorHandoff({ investigationId: "CASE-300", rows: [
    row(), row({ requirement: "C2: Another requirement", risk: "R2: Related risk", sources: "risks.md:12" }),
  ] });
  const instruction = markdown.split("## Copy to project's generator")[1];

  assert.equal((instruction.match(/TC-01/g) ?? []).length, 1);
  assert.match(markdown, /R1, R2/);
  assert.match(markdown, /risks\.md:7; specs\/CASE-300\.plan\.md:3; risks\.md:12/);
});

test("missing coverage links stay visible and suppress instructions when nothing is ready", () => {
  assert.equal(typeof buildGeneratorHandoff, "function", "handoff builder must be exported");
  const markdown = buildGeneratorHandoff({ investigationId: "CASE-300", rows: [
    row({ requirement: "C2: No linked risk", risk: "", case: "", mappedTest: "", mappingStatus: "no linked risk", sources: "investigation.md:10" }),
    row({ requirement: "C3: Missing test mapping", risk: "R3: no mapped case", case: "", mappedTest: "", mappingStatus: "no mapped test", sources: "risks.md:14" }),
  ] });

  assert.match(markdown, /C2: No linked risk/);
  assert.match(markdown, /C3: Missing test mapping/);
  assert.match(markdown, /no linked risk/);
  assert.match(markdown, /no mapped test/);
  assert.doesNotMatch(markdown, /Copy to project's generator/);
});

test("imported text is escaped in Markdown output", () => {
  assert.equal(typeof buildGeneratorHandoff, "function", "handoff builder must be exported");
  const markdown = buildGeneratorHandoff({ investigationId: "CASE-300", rows: [row({
    risk: 'R1: text | <img src=x>\n[link](javascript:alert(1))',
    mappedTest: "tests/a|b.spec.ts",
    sources: "risks.md:7",
  })] });

  assert.match(markdown, /\\\|/);
  assert.match(markdown, /tests\/a\\\|b\.spec\.ts/);
  assert.equal(markdown.includes("\\\\|"), false);
  assert.match(markdown, /&lt;img/);
  assert.doesNotMatch(markdown, /<img/);
  assert.doesNotMatch(markdown, /\[link\]\(javascript:/);
});

test("handoff CLI prints Markdown without creating artifacts", async (t) => {
  const root = await fixtureProject(t);
  const risksPath = path.join(root, "qa-artifacts", "CASE-300", "risks.md");
  const before = await readFile(risksPath, "utf8");
  const result = spawnSync(process.execPath, [cli, "handoff", "--root", root, "--investigation", "CASE-300"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Playwright generator handoff: CASE-300/);
  assert.match(result.stdout, /specs\/CASE-300\.plan\.md/);
  assert.match(result.stdout, /Blocked cases/);
  assert.doesNotMatch(result.stdout, /Copy to project's generator/);
  assert.equal(await readFile(risksPath, "utf8"), before);
  assert.equal(await readFile(path.join(root, "qa-artifacts", "CASE-300", "handoff.md")).catch(() => null), null);
});
