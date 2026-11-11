import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

let checkArtifacts;
let handleHookEvent;
try {
  ({ checkArtifacts } = await import("./qa-check.mjs"));
} catch {
  // Keep the RED run an assertion failure until the checker is implemented.
}
try {
  ({ handleHookEvent } = await import("./qa-check-hook.mjs"));
} catch {
  // The hook adapter is added after its RED tests.
}

const implemented = typeof checkArtifacts === "function";
const hookImplemented = typeof handleHookEvent === "function";

async function workspace(t, investigation = "CASE-300") {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifactDir = path.join(root, "qa-artifacts", investigation);
  await mkdir(artifactDir, { recursive: true });
  return { root, artifactDir, investigation };
}

function investigationRecord(id = "CASE-300") {
  return `# Investigation: Filter tasks
Format version: 1
Local ID: ${id}
Captured: 2026-11-11

## Sources
| ID | Kind | Locator | Captured | Revision or digest | External identity |
|---|---|---|---|---|---|
| S1 | CSV | cases.csv:2 | 2026-11-11 | sha256:abc | none |

## Cases and requirements
| ID | Kind | Title or claim | Source ID | Location | Revision |
|---|---|---|---|---|---|
| C1 | case | Filter tasks | S1 | row 2 | 1 |

## Missing inputs
- none

## Run evidence
| ID | Source ID | Test/run reference | Observed result | Environment | Code revision |

## Conflicting claims
- none

## Import history
| Source ID | Source revision | Mapping revision | Case IDs | Result |
|---|---|---|---|---|
| S1 | sha256:abc | map-1 | C1 | imported |
`;
}

function risksArtifact(rows = ["| R1 | Filter | Results are filtered | Matching rows are returned | yes | PROPOSED |"]) {
  return `# Risks: Filter tasks
Ticket: CASE-300
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ID | Step/State | Risk | Proposed oracle | Observable | Status |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
}

test("checker exports the artifact-check API", () => {
  assert.equal(typeof checkArtifacts, "function");
});

test("Codex hook adapter exports its event handler", () => {
  assert.equal(typeof handleHookEvent, "function");
});

test("accepts valid intake and risk artifacts without modifying them", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  const record = investigationRecord();
  const risks = `${risksArtifact(["| R1 | Filter | Results are filtered | Matching rows are returned | yes | APPROVED |"])}
## Generated mapping (2026-11-11)
| Risk ID | TC ID | File |
|---|---|---|
| R1 | TC-01 | tests/filter.spec.ts |
`;
  await mkdir(path.join(root, "specs"), { recursive: true });
  await writeFile(path.join(artifactDir, "investigation.md"), record);
  await writeFile(path.join(artifactDir, "risks.md"), risks);
  await writeFile(path.join(root, "specs", "CASE-300.plan.md"), "# Plan\n\n### TC-01: Filter tasks\n");

  const result = await checkArtifacts(root);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(await readFile(path.join(artifactDir, "investigation.md"), "utf8"), record);
  assert.equal(await readFile(path.join(artifactDir, "risks.md"), "utf8"), risks);
});

test("reports an unsafe investigation ID and missing required sections", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t, "case-invalid");
  await writeFile(path.join(artifactDir, "investigation.md"), "# Investigation\nFormat version: 1\nLocal ID: OTHER\n");

  const { diagnostics } = await checkArtifacts(root);
  const codes = new Set(diagnostics.map((item) => item.code));

  assert.ok(codes.has("INVESTIGATION_ID_MISMATCH"));
  assert.ok(codes.has("INVESTIGATION_SECTION_MISSING"));
  assert.ok(diagnostics.every((item) => item.line > 0 && item.path.includes("investigation.md")));
});

test("reports duplicate risk IDs and unknown status values", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await writeFile(path.join(artifactDir, "risks.md"), risksArtifact([
    "| R1 | Filter | Results are filtered | Matching rows are returned | yes | PROPOSED |",
    "| R1 | Clear | Results remain filtered | All rows return | yes | MAYBE |",
  ]));

  const { diagnostics } = await checkArtifacts(root);
  const codes = new Set(diagnostics.map((item) => item.code));

  assert.ok(codes.has("RISK_ID_DUPLICATE"));
  assert.ok(codes.has("RISK_STATUS_INVALID"));
});

test("reports generated mappings with an unknown risk or missing plan entry", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await mkdir(path.join(root, "specs"), { recursive: true });
  await writeFile(path.join(artifactDir, "risks.md"), `${risksArtifact()}\n## Generated mapping (2026-11-11)\n| Risk ID | TC ID | File |\n|---|---|---|\n| R404 | TC-09 | tests/filter.spec.ts |\n| R1 | TC-10 | tests/filter.spec.ts |\n`);
  await writeFile(path.join(root, "specs", "CASE-300.plan.md"), "# Plan\n\n### TC-01: Filter\n");

  const { diagnostics } = await checkArtifacts(root);
  const codes = new Set(diagnostics.map((item) => item.code));

  assert.ok(codes.has("MAPPING_RISK_UNKNOWN"));
  assert.ok(codes.has("MAPPING_TC_MISSING"));
});

test("preserves escaped pipes in risk-table cells", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await writeFile(path.join(artifactDir, "risks.md"), risksArtifact([
    "| R1 | Filter | Results are filtered | Keep open\\|closed results | yes | PROPOSED |",
  ]));

  const { diagnostics } = await checkArtifacts(root);

  assert.deepEqual(diagnostics, []);
});

test("rejects impossible dates in generated-mapping headings", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await writeFile(path.join(artifactDir, "risks.md"), `${risksArtifact()}\n## Generated mapping (2026-02-31)\n| Risk ID | TC ID | File |\n|---|---|---|\n`);

  const { diagnostics } = await checkArtifacts(root);

  assert.ok(diagnostics.some((item) => item.code === "MAPPING_DATE_INVALID"));
});

test("requires a mapped TC ID to be a plan heading, not a prose mention", { skip: !implemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await mkdir(path.join(root, "specs"), { recursive: true });
  await writeFile(path.join(artifactDir, "risks.md"), `${risksArtifact()}\n## Generated mapping (2026-11-11)\n| Risk ID | TC ID | File |\n|---|---|---|\n| R1 | TC-01 | tests/filter.spec.ts |\n`);
  await writeFile(path.join(root, "specs", "CASE-300.plan.md"), "# Plan\n\nThis paragraph mentions TC-01 but does not define an entry.\n");

  const { diagnostics } = await checkArtifacts(root);

  assert.ok(diagnostics.some((item) => item.code === "MAPPING_TC_MISSING"));
});

test("treats a missing artifact directory as a no-op", { skip: !implemented }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-check-empty-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await checkArtifacts(root);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.summary, /no QA artifacts/i);
});

test("reports a typoed repository root instead of silently succeeding", { skip: !implemented }, async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "qa-check-missing-root-"));
  t.after(() => rm(parent, { recursive: true, force: true }));

  const result = await checkArtifacts(path.join(parent, "typoed-repo"));

  assert.ok(result.diagnostics.some((item) => item.code === "CHECK_ROOT_MISSING"));
});

test("accepts an empty Codex post-tool event and reports no change", { skip: !hookImplemented }, async (t) => {
  const { root } = await workspace(t);
  const result = await handleHookEvent(JSON.stringify({ hook_event_name: "PostToolUse", cwd: root, tool_name: "apply_patch" }));

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test("returns cited artifact diagnostics to Codex as post-tool context", { skip: !hookImplemented }, async (t) => {
  const { root, artifactDir } = await workspace(t);
  await writeFile(path.join(artifactDir, "risks.md"), risksArtifact([
    "| R1 | Filter | Results are filtered | Matching rows are returned | yes | UNKNOWN |",
  ]));
  const result = await handleHookEvent(JSON.stringify({ hook_event_name: "PostToolUse", cwd: root, tool_name: "apply_patch" }));
  const output = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0);
  assert.equal(output.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(output.hookSpecificOutput.additionalContext, /risks\.md:\d+ \[RISK_STATUS_INVALID\]/);
});

test("malformed hook input fails open with manual-check guidance", { skip: !hookImplemented }, async () => {
  const result = await handleHookEvent("not-json");
  const output = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0);
  assert.match(output.systemMessage, /manual check/i);
});

test("Codex hook sample is valid and targets post-tool apply_patch", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const configPath = path.join(repoRoot, "qa-harness/hooks/codex-hooks.example.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const group = config.hooks.PostToolUse[0];

  assert.equal(group.matcher, "apply_patch");
  assert.equal(group.hooks[0].type, "command");
  assert.match(group.hooks[0].command, /qa-check-hook\.mjs/);
});

test("hook executable emits Codex JSON for the supplied workspace", { skip: !hookImplemented }, async (t) => {
  const { root } = await workspace(t);
  const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "qa-check-hook.mjs");
  const event = JSON.stringify({ hook_event_name: "PostToolUse", cwd: root, tool_name: "apply_patch" });
  const result = spawnSync(process.execPath, [scriptPath], { cwd: root, input: event, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test("CI runs the same checker and its Node test suite", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/qa-harness-check.yml"), "utf8");

  assert.match(workflow, /node qa-harness\/checks\/qa-check\.mjs --root qa-harness\/fixtures\/checks/);
  assert.match(workflow, /node --test qa-harness\/checks\/\*\.test\.mjs/);
});

test("CI and documentation cover offline Playwright report ingestion", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/qa-harness-check.yml"), "utf8");
  const checkDocs = await readFile(path.join(repoRoot, "qa-harness/checks/README.md"), "utf8");
  const fixtureDocs = await readFile(path.join(repoRoot, "qa-harness/fixtures/run-report/README.md"), "utf8");

  assert.match(workflow, /qa-run-report\.test\.mjs/);
  assert.match(checkDocs, /qa-run-report\.mjs/);
  assert.match(checkDocs, /does not verify an oracle/i);
  assert.match(fixtureDocs, /synthetic/i);
  assert.match(fixtureDocs, /no executable Playwright test code/i);
});
