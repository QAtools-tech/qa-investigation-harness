import assert from "node:assert/strict";
import test from "node:test";

function report({ runId, target = "staging", investigationId = "QA-1423" }) {
  return {
    schemaVersion: 2,
    investigationId,
    run: { runId, target, projectNames: ["chromium"] },
    tests: [],
    coverage: { links: [] },
  };
}

function mappedReport({ runId, status = "expected", caseId = "TC-1", projectName = "chromium", projectNames = [projectName], mappings = null, runs = null, tests = null }) {
  const sourcePointer = "/suites/0/tests/0";
  const testRecords = tests ?? (status === null ? [] : [{ sourcePointer, projectName, status }]);
  return {
    ...report({ runId }),
    run: { ...report({ runId }).run, projectNames },
    tests: testRecords,
    coverage: {
      links: [
        ...(mappings ?? [{ kind: "plan-test", status: "linked", fromId: caseId, toId: "tests/example.spec.ts", targetLocator: "qa-artifacts/risks.md:7" }]),
        ...(runs ?? (status === null ? [] : [{ kind: "test-run", status: "linked", fromId: caseId, toId: sourcePointer, runStatus: status, targetLocator: sourcePointer }])),
      ],
    },
  };
}

test("compares reports for the same investigation and exact target", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const result = buildRunComparison(report({ runId: "before" }), report({ runId: "after" }));

  assert.equal(result.investigationId, "QA-1423");
  assert.equal(result.before.runId, "before");
  assert.equal(result.after.runId, "after");
  assert.deepEqual(result.rows, []);
});

test("rejects target labels that differ only by surrounding whitespace", async () => {
  const { buildRunComparison, RunComparisonInputError } = await import("./run-comparison.mjs");

  assert.throws(
    () => buildRunComparison(report({ runId: "before" }), report({ runId: "after", target: " staging " })),
    RunComparisonInputError,
  );
});

test("rejects reports from different investigations", async () => {
  const { buildRunComparison, RunComparisonInputError } = await import("./run-comparison.mjs");

  assert.throws(
    () => buildRunComparison(report({ runId: "before" }), report({ runId: "after", investigationId: "QA-1424" })),
    RunComparisonInputError,
  );
});

test("classifies runner status transitions without asserting oracle quality", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const transitions = [
    ["expected", "expected", "unchanged"],
    ["expected", "failure", "regressed"],
    ["expected", "flaky", "regressed"],
    ["failure", "expected", "recovered"],
    ["flaky", "expected", "recovered"],
    ["failure", "flaky", "changed"],
    ["unknown", "unknown", "unchanged"],
    ["unknown", "expected", "changed"],
  ];

  for (const [beforeStatus, afterStatus, classification] of transitions) {
    const result = buildRunComparison(
      mappedReport({ runId: "before", status: beforeStatus }),
      mappedReport({ runId: "after", status: afterStatus }),
    );
    assert.equal(result.rows[0].classification, classification, `${beforeStatus} -> ${afterStatus}`);
  }
});

test("leaves missing, unmapped, and excluded project evidence not comparable", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const before = mappedReport({ runId: "before", status: "expected", projectNames: ["chromium"] });
  const after = mappedReport({ runId: "after", status: null, projectNames: ["chromium", "firefox"] });
  const missingRun = buildRunComparison(before, after).rows.find((row) => row.projectName === "chromium");
  const excludedProject = buildRunComparison(before, after).rows.find((row) => row.projectName === "firefox");
  assert.equal(missingRun.after.evidence, "no-result");
  assert.equal(missingRun.classification, "not comparable");
  assert.equal(excludedProject.before.evidence, "project-not-included");
  assert.equal(excludedProject.after.evidence, "no-result");
  assert.equal(excludedProject.classification, "not comparable");

  const unmapped = mappedReport({ runId: "after", status: "expected", mappings: [] });
  const row = buildRunComparison(before, unmapped).rows[0];
  assert.equal(row.after.evidence, "unmapped");
  assert.equal(row.classification, "not comparable");
  assert.equal(JSON.stringify(row).match(/added|removed|passed|failed/gi), null);
});

test("creates a comparison row for every case and project in either report", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const result = buildRunComparison(
    mappedReport({ runId: "before", caseId: "TC-1", projectNames: ["chromium"] }),
    mappedReport({ runId: "after", caseId: "TC-2", projectName: "firefox", projectNames: ["firefox"] }),
  );

  assert.deepEqual(result.rows.map(({ caseId, projectName }) => [caseId, projectName]), [
    ["TC-1", "chromium"],
    ["TC-1", "firefox"],
    ["TC-2", "chromium"],
    ["TC-2", "firefox"],
  ]);
});

test("deduplicates identical links and marks conflicting mappings or results ambiguous", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const base = mappedReport({ runId: "before", status: "expected" });
  const sameMapping = base.coverage.links[0];
  const sameExecution = base.coverage.links[1];
  const duplicateLinks = {
    ...base,
    coverage: { links: [...base.coverage.links, { ...sameMapping }, { ...sameExecution }] },
  };
  assert.equal(buildRunComparison(duplicateLinks, base).rows[0].before.evidence, "observed");

  const conflict = {
    ...base,
    coverage: { links: [...base.coverage.links, { ...sameMapping, toId: "tests/other.spec.ts" }] },
  };
  assert.equal(buildRunComparison(conflict, base).rows[0].before.evidence, "ambiguous");

  const twoResults = mappedReport({
    runId: "before",
    status: "expected",
    runs: [
      { kind: "test-run", status: "linked", fromId: "TC-1", toId: "/suites/0/tests/0", runStatus: "expected", targetLocator: "/suites/0/tests/0" },
      { kind: "test-run", status: "linked", fromId: "TC-1", toId: "/suites/0/tests/1", runStatus: "expected", targetLocator: "/suites/0/tests/1" },
    ],
    tests: [
      { sourcePointer: "/suites/0/tests/0", projectName: "chromium", status: "expected" },
      { sourcePointer: "/suites/0/tests/1", projectName: "chromium", status: "expected" },
    ],
  });
  assert.equal(buildRunComparison(twoResults, base).rows[0].before.evidence, "ambiguous");
});

test("marks non-unique pointer joins and status disagreement ambiguous", async () => {
  const { buildRunComparison } = await import("./run-comparison.mjs");
  const base = mappedReport({ runId: "before", status: "expected" });
  const duplicatePointer = {
    ...base,
    tests: [...base.tests, { ...base.tests[0], projectName: "firefox" }],
    run: { ...base.run, projectNames: ["chromium", "firefox"] },
  };
  const rows = buildRunComparison(duplicatePointer, base).rows;
  assert.equal(rows.find((row) => row.projectName === "chromium").before.evidence, "ambiguous");
  assert.equal(rows.find((row) => row.projectName === "firefox").before.evidence, "ambiguous");

  const disagreeing = {
    ...base,
    tests: [{ ...base.tests[0], status: "failure" }],
  };
  assert.equal(buildRunComparison(disagreeing, base).rows[0].before.evidence, "ambiguous");
});

test("rejects malformed and unsupported run reports", async () => {
  const { buildRunComparison, RunComparisonInputError } = await import("./run-comparison.mjs");
  assert.throws(() => buildRunComparison({ ...report({ runId: "before" }), schemaVersion: 1 }, report({ runId: "after" })), RunComparisonInputError);
  assert.throws(() => buildRunComparison({ ...report({ runId: "before" }), coverage: { links: [null] } }, report({ runId: "after" })), RunComparisonInputError);
});
