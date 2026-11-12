import assert from "node:assert/strict";
import test from "node:test";

let buildTriage;
let renderRunReport;
try {
  ({ buildTriage, renderRunReport } = await import("./run-report-render.mjs"));
} catch {
  // The API assertion is the intended RED until the renderer is implemented.
}

const implemented = typeof buildTriage === "function" && typeof renderRunReport === "function";

function testResult({ title = "Filter tasks", status = "failure", order = 0, startTime = null, file = "tests/filter.spec.ts" } = {}) {
  return {
    order,
    projectName: "chromium",
    titlePath: ["Task list", title],
    file,
    line: 42,
    column: 3,
    expectedStatus: "passed",
    status,
    attempts: startTime ? [{ status: "failed", duration: 100, retry: 0, startTime }] : [{ status: "failed", duration: 100, retry: 0, startTime: null }],
    sourcePointer: `/suites/0/specs/${order}/tests/0`,
  };
}

function run(tests) {
  return {
    metadata: {
      projectNames: ["chromium"],
      startedAt: "2026-11-11T10:00:00.000Z",
      source: "playwright-report.json",
      runId: "run-17",
      target: "staging",
      revision: "abc123",
      capturedAt: null,
    },
    tests,
  };
}

const coverage = {
  investigationId: "CASE-300",
  links: [{ kind: "test-run", status: "linked", fromId: "TC-01", toId: "/suites/0/specs/0/tests/0", conformance: "not-reviewed" }],
  orphanTests: [],
  unresolvedMappings: [{ tcId: "TC-404", reason: "unknown TC ID" }],
  gaps: [{ status: "missing execution evidence", fromId: "TC-02", reason: "No matching run result." }],
};

test("report renderer exports triage and rendering functions", () => {
  assert.equal(typeof buildTriage, "function");
  assert.equal(typeof renderRunReport, "function");
});

test("triages failure and flaky results in timeline order with observations separated from hypotheses", { skip: !implemented }, () => {
  const normalized = run([
    testResult({ title: "Later failure", status: "failure", order: 0, startTime: "2026-11-11T10:02:00Z" }),
    testResult({ title: "Earlier flaky", status: "flaky", order: 1, startTime: "2026-11-11T10:01:00Z" }),
    testResult({ title: "Expected", status: "expected", order: 2 }),
  ]);
  const triage = buildTriage(normalized, coverage);

  assert.deepEqual(triage.map((item) => item.titlePath.at(-1)), ["Earlier flaky", "Later failure"]);
  assert.equal(triage[0].observed.status, "flaky");
  assert.equal(triage[0].observed.source.file, "tests/filter.spec.ts");
  assert.equal(triage[0].observed.source.reportPointer, "/suites/0/specs/1/tests/0");
  assert.deepEqual(triage[0].possibleCauses, []);
});

test("renders JSON and Markdown with coverage, run provenance, raw counts, and limitations", { skip: !implemented }, () => {
  const normalized = run([
    testResult({ status: "expected", order: 0 }),
    testResult({ status: "failure", order: 1 }),
    testResult({ status: "skipped", order: 2 }),
    testResult({ status: "flaky", order: 3 }),
    testResult({ status: "unknown", order: 4 }),
  ]);
  const result = renderRunReport(normalized, coverage);

  assert.equal(result.json.schemaVersion, 2);
  assert.equal(result.json.investigationId, "CASE-300");
  assert.equal(result.json.run.runId, "run-17");
  assert.equal(result.json.run.target, "staging");
  assert.equal(result.json.outcomeCounts.expected, 1);
  assert.equal(result.json.outcomeCounts.failure, 1);
  assert.equal(result.json.outcomeCounts.skipped, 1);
  assert.equal(result.json.outcomeCounts.flaky, 1);
  assert.equal(result.json.outcomeCounts.unknown, 1);
  assert.deepEqual(result.json.coverage.links, coverage.links);
  assert.deepEqual(result.json.coverage.gaps, coverage.gaps);
  assert.deepEqual(result.json.coverage.unresolvedMappings, coverage.unresolvedMappings);
  assert.match(result.json.limitations.join(" "), /does not verify an oracle/i);
  assert.match(result.markdown, /missing execution evidence/i);
  assert.match(result.markdown, /TC-404/);
  assert.match(result.markdown, /not-reviewed/);
  assert.match(result.markdown, /does not verify an oracle/i);
});

test("renders safe per-attempt attachment links and strips candidate paths and bodies", { skip: !implemented }, () => {
  const normalized = run([{
    ...testResult({ title: "TC-01 attachment evidence", status: "failure", order: 0 }),
    attempts: [{
      status: "failed",
      duration: 100,
      retry: 0,
      startTime: "2026-11-11T10:00:00Z",
      attachments: [{
        name: "trace ] [review](https://evil.example).zip",
        contentType: "application/zip",
        path: "test-results/trace [x] (1)#?.zip",
        availability: "available",
        candidatePath: "C:/private/trace.zip",
        body: "attachment secret",
      }],
    }],
  }]);
  const result = renderRunReport(normalized, coverage, { attachmentLinkPrefix: "../.." });
  const outputAttachment = result.json.tests[0].attempts[0].attachments[0];

  assert.deepEqual(outputAttachment, {
    name: "trace ] [review](https://evil.example).zip",
    contentType: "application/zip",
    path: "test-results/trace [x] (1)#?.zip",
    availability: "available",
  });
  assert.match(result.markdown, /trace.*trace%20%5Bx%5D%20%281%29%23%3F\.zip/);
  assert.equal(JSON.stringify(result.json).includes("C:/private/trace.zip"), false);
  assert.equal(JSON.stringify(result.json).includes("attachment secret"), false);
  assert.match(result.markdown, /retry 0/);
});

test("renders unavailable attachments without exposing a link path", { skip: !implemented }, () => {
  const normalized = run([{
    ...testResult({ title: "TC-02 unavailable attachment", status: "failure" }),
    attempts: [{
      status: "failed",
      duration: 50,
      retry: 0,
      startTime: null,
      attachments: [{ name: "outside trace", contentType: "application/zip", path: null, availability: "unavailable" }],
    }],
  }]);
  const result = renderRunReport(normalized, coverage);

  assert.equal(result.json.tests[0].attempts[0].attachments[0].path, null);
  assert.match(result.markdown, /outside trace.*unavailable/i);
  assert.doesNotMatch(result.markdown, /\[outside trace/);
});

test("preserves a validated attachment path without text sanitization", { skip: !implemented }, () => {
  const validatedPath = "test-results/trace\u0001/evidence.zip";
  const normalized = run([{
    ...testResult({ title: "TC-03 unusual valid path", status: "failure" }),
    attempts: [{
      status: "failed",
      duration: 50,
      retry: 0,
      startTime: null,
      attachments: [{ name: "trace", contentType: "application/zip", path: validatedPath, availability: "available" }],
    }],
  }]);
  const result = renderRunReport(normalized, coverage);

  assert.equal(result.json.tests[0].attempts[0].attachments[0].path, validatedPath);
  assert.ok(result.markdown.includes("test-results/trace%01/evidence.zip"));
});

test("contains bare carriage returns in attachment names and content types", { skip: !implemented }, () => {
  const normalized = run([{
    ...testResult({ title: "TC-04 carriage-return metadata", status: "failure" }),
    attempts: [{
      status: "failed",
      duration: 50,
      retry: 0,
      startTime: null,
      attachments: [{
        name: "trace\r\r- FORGED ROW",
        contentType: "image/png\r\r- FORGED TYPE",
        path: null,
        availability: "unavailable",
      }],
    }],
  }]);
  const result = renderRunReport(normalized, coverage);

  assert.equal(result.markdown.includes("\r"), false);
  assert.match(result.markdown, /trace - FORGED ROW \(image\/png - FORGED TYPE; file unavailable\)/);
  assert.doesNotMatch(result.markdown, /^\s*- FORGED (ROW|TYPE)$/m);
});

test("renders orphan tests, per-test outcomes, conformance findings, and retry timelines in Markdown", { skip: !implemented }, () => {
  const normalized = run([
    {
      ...testResult({ title: "Flaky mapped test", status: "flaky", order: 0 }),
      attempts: [
        { status: "failed", duration: 80, retry: 0, startTime: "2026-11-11T10:00:00Z" },
        { status: "passed", duration: 90, retry: 1, startTime: "2026-11-11T10:00:01Z" },
      ],
    },
  ]);
  const detailedCoverage = {
    ...coverage,
    links: [{ kind: "test-run", status: "linked", fromId: "TC-01", toId: "/suites/0/specs/0/tests/0", runStatus: "flaky", conformance: "weak", conformanceFinding: "Toast only", conformanceLocator: "tests/filter.spec.ts:42" }],
    orphanTests: [{ testLocator: "/suites/0/specs/3/tests/0", titlePath: ["Unmapped visible result"], file: "tests/other.spec.ts", reason: "No exact mapping match." }],
  };
  const result = renderRunReport(normalized, detailedCoverage);

  assert.match(result.markdown, /Unmapped visible result/);
  assert.match(result.markdown, /flaky/);
  assert.match(result.markdown, /weak/);
  assert.match(result.markdown, /Toast only/);
  assert.ok(result.markdown.includes(String.raw`tests/filter\.spec\.ts:42`));
  assert.match(result.markdown, /failed.*passed/);
});

test("escapes hostile Markdown and keeps missing/equal timestamps in stable report order", { skip: !implemented }, () => {
  const normalized = run([
    testResult({ title: "# [click](https://evil.example) | > text\n## forged heading", order: 0 }),
    testResult({ title: "second", order: 1 }),
    testResult({ title: "third", order: 2 }),
  ]);
  normalized.tests[1].attempts[0].startTime = "2026-11-11T10:00:00Z";
  normalized.tests[2].attempts[0].startTime = "2026-11-11T10:00:00Z";
  const result = renderRunReport(normalized, coverage);
  const triage = buildTriage(normalized, coverage);

  assert.match(result.markdown, /\\\[click\\\]\\\(https:\/\/evil\\\.example\\\)/);
  assert.doesNotMatch(result.markdown, /^## forged heading$/m);
  assert.deepEqual(triage.map((item) => item.order), [1, 2, 0]);
});

test("bounds imported title text before Markdown rendering", { skip: !implemented }, () => {
  const title = `${"A".repeat(600)}TRAILING_SECRET`;
  const result = renderRunReport(run([testResult({ title })]), coverage);

  assert.equal(result.markdown.includes("TRAILING_SECRET"), false);
});
