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

function storedRunReport({ runId, target = "staging", investigationId = "CASE-300", status = "expected" }) {
  const sourcePointer = "/suites/0/tests/0";
  return {
    schemaVersion: 2,
    investigationId,
    run: { runId, target, projectNames: ["chromium"] },
    outcomeCounts: { expected: status === "expected" ? 1 : 0, failure: status === "failure" ? 1 : 0, skipped: 0, flaky: 0, unknown: 0 },
    tests: [{ projectName: "chromium", status, sourcePointer }],
    coverage: {
      links: [
        { kind: "plan-test", status: "linked", fromId: "TC-1", toId: "tests/filter.spec.ts", targetLocator: "qa-artifacts/CASE-300/risks.md:8" },
        { kind: "test-run", status: "linked", fromId: "TC-1", toId: sourcePointer, runStatus: status, targetLocator: sourcePointer },
      ],
      gaps: [], unresolvedMappings: [], orphanTests: [],
    },
    triage: [],
    limitations: [],
  };
}

async function comparisonInputs(paths, beforeOptions = {}, afterOptions = {}) {
  const before = path.join(paths.root, "out", "before-run.json");
  const after = path.join(paths.root, "out", "after-run.json");
  await writeFile(before, JSON.stringify(storedRunReport({ runId: "before", ...beforeOptions })));
  await writeFile(after, JSON.stringify(storedRunReport({ runId: "after", ...afterOptions })));
  return {
    root: paths.root,
    before,
    after,
    json: path.join(paths.root, "out", "comparison.json"),
    markdown: path.join(paths.root, "out", "comparison.md"),
  };
}

function compareArgs(paths, overrides = {}) {
  const values = {
    "--root": paths.root,
    "--before": paths.before,
    "--after": paths.after,
    "--json-out": paths.json,
    "--markdown-out": paths.markdown,
    ...overrides,
  };
  return ["compare", ...Object.entries(values).flatMap(([flag, value]) => value === true ? [flag] : [flag, value])];
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

test("compares two saved harness run reports", async (t) => {
  const paths = await workspace(t);
  const inputs = await comparisonInputs(paths, {}, { status: "failure" });
  const result = invoke(compareArgs(inputs), paths.root);

  assert.equal(result.status, 0, result.stderr);
  const comparison = JSON.parse(await readFile(inputs.json, "utf8"));
  const markdown = await readFile(inputs.markdown, "utf8");
  assert.equal(comparison.schemaVersion, 1);
  assert.equal(comparison.investigationId, "CASE-300");
  assert.equal(comparison.before.runId, "before");
  assert.equal(comparison.after.runId, "after");
  assert.equal(comparison.rows[0].classification, "regressed");
  assert.match(markdown, /regressed/);
});

test("rejects saved reports with different targets or investigations", async (t) => {
  const paths = await workspace(t);
  for (const options of [{ target: "production" }, { investigationId: "CASE-301" }]) {
    const inputs = await comparisonInputs(paths, {}, options);
    const result = invoke(compareArgs(inputs), paths.root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /same target|same investigation/i);
    await assert.rejects(readFile(inputs.json));
    await assert.rejects(readFile(inputs.markdown));
  }
});

test("rejects malformed and unsupported saved reports without outputs", async (t) => {
  const paths = await workspace(t);
  const inputs = await comparisonInputs(paths);
  const malformedPath = path.join(paths.root, "out", "malformed.json");
  await writeFile(malformedPath, "{broken");
  const malformed = invoke(compareArgs(inputs, { "--after": malformedPath }), paths.root);
  assert.equal(malformed.status, 2);
  await assert.rejects(readFile(inputs.json));
  const unsupportedPath = path.join(paths.root, "out", "unsupported.json");
  await writeFile(unsupportedPath, JSON.stringify({ ...storedRunReport({ runId: "unsupported" }), schemaVersion: 99 }));
  const unsupported = invoke(compareArgs(inputs, { "--after": unsupportedPath }), paths.root);
  assert.equal(unsupported.status, 2);
  await assert.rejects(readFile(inputs.json));
});

test("protects both inputs and preserves paired-output semantics", async (t) => {
  const paths = await workspace(t);
  const inputs = await comparisonInputs(paths);
  const before = await readFile(inputs.before, "utf8");
  const after = await readFile(inputs.after, "utf8");

  for (const protectedInput of [inputs.before, inputs.after]) {
    const result = invoke(compareArgs({ ...inputs, json: protectedInput }, { "--force": true }), paths.root);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(await readFile(inputs.before, "utf8"), before);
    assert.equal(await readFile(inputs.after, "utf8"), after);
  }

  const outside = path.join(path.dirname(paths.root), "outside-" + path.basename(paths.root) + ".json");
  const escape = invoke(compareArgs(inputs, { "--json-out": outside }), paths.root);
  assert.equal(escape.status, 2);
  await assert.rejects(readFile(outside));

  const sameOutput = invoke(compareArgs({ ...inputs, markdown: inputs.json }), paths.root);
  assert.equal(sameOutput.status, 2);
  await writeFile(inputs.json, "keep-json");
  await writeFile(inputs.markdown, "keep-markdown");
  const blocked = invoke(compareArgs(inputs), paths.root);
  assert.equal(blocked.status, 3);
  assert.equal(await readFile(inputs.json, "utf8"), "keep-json");
  const forced = invoke(compareArgs(inputs, { "--force": true }), paths.root);
  assert.equal(forced.status, 0, forced.stderr);
  assert.notEqual(await readFile(inputs.json, "utf8"), "keep-json");
  assert.notEqual(await readFile(inputs.markdown, "utf8"), "keep-markdown");
});

test("rejects compare output paths that escape through a directory symlink", async (t) => {
  const paths = await workspace(t);
  const inputs = await comparisonInputs(paths);
  const alias = path.join(paths.root, "comparison-alias");
  const outside = path.join(path.dirname(paths.root), "compare-outside-" + path.basename(paths.root));
  await mkdir(outside);
  t.after(() => rm(outside, { recursive: true, force: true }));
  try {
    await symlink(outside, alias, "junction");
  } catch (error) {
    t.skip(`Directory junction unavailable: ${error.code ?? error.message}`);
    return;
  }
  const result = invoke(compareArgs({ ...inputs, markdown: path.join(alias, "aliased.md") }), paths.root);
  assert.equal(result.status, 2);
  await assert.rejects(readFile(path.join(outside, "aliased.md")));
});

test("keeps attachment links relative to a nested Markdown report", async (t) => {
  const paths = await workspace(t);
  const reportInput = JSON.parse(await readFile(paths.report, "utf8"));
  reportInput.suites[0].suites[0].specs[0].tests[1].results[0].attachments = [
    { name: "safe trace", contentType: "text/plain", path: "qa-artifacts/CASE-300/trace.txt" },
  ];
  await mkdir(path.join(paths.root, "qa-artifacts", "CASE-300"), { recursive: true });
  await writeFile(path.join(paths.root, "qa-artifacts", "CASE-300", "trace.txt"), "synthetic trace");
  await writeFile(paths.report, JSON.stringify(reportInput));
  const nested = path.join(paths.root, "out", "nested", "reports");
  await mkdir(nested, { recursive: true });
  const result = invoke(argsFor(paths, {
    "--json-out": path.join(nested, "run.json"),
    "--markdown-out": path.join(nested, "run.md"),
  }), paths.root);

  assert.equal(result.status, 0, result.stderr);
  const markdown = await readFile(path.join(nested, "run.md"), "utf8");
  assert.match(markdown, /\.\.\/\.\.\/\.\.\/qa-artifacts\/CASE-300\/trace\.txt/);
});
