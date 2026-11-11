import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

let parsePlaywrightReport;
let PlaywrightReportError;
try {
  ({ parsePlaywrightReport, PlaywrightReportError } = await import("./playwright-json.mjs"));
} catch {
  // Keep the RED run as a clear missing-export assertion until implementation.
}

const implemented = typeof parsePlaywrightReport === "function";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function fixtureReport() {
  return JSON.parse(await readFile(path.join(repoRoot, "qa-harness/fixtures/run-report/playwright-report.json"), "utf8"));
}

test("Playwright JSON parser exports the promised API", () => {
  assert.equal(typeof parsePlaywrightReport, "function");
  assert.equal(typeof PlaywrightReportError, "function");
});

test("normalizes nested suites, projects, source locations, attempts, and categories", { skip: !implemented }, async () => {
  const normalized = parsePlaywrightReport(await fixtureReport(), { source: "playwright-report.json" });

  assert.equal(normalized.metadata.startedAt, "2026-11-11T10:00:00.000Z");
  assert.deepEqual(normalized.metadata.projectNames, ["chromium", "firefox", "webkit"]);
  assert.equal(normalized.tests.length, 4);
  assert.deepEqual(normalized.tests[0].titlePath, ["Filters", "Task list", "TC-01 Filter tasks"]);
  assert.equal(normalized.tests[0].file, "tests/filter.spec.ts");
  assert.equal(normalized.tests[0].line, 12);
  assert.equal(normalized.tests[0].column, 3);
  assert.equal(normalized.tests[0].projectName, "chromium");
  assert.equal(normalized.tests[0].expectedStatus, "passed");
  assert.equal(normalized.tests[0].status, "expected");
  assert.equal(normalized.tests[0].attempts[0].duration, 120);
  assert.equal(normalized.tests[0].attempts[0].retry, 0);
  assert.equal(normalized.tests[0].attempts[0].startTime, "2026-11-11T10:00:01.000Z");
  assert.equal(normalized.tests[0].sourcePointer, "/suites/0/suites/0/specs/0/tests/0");
  assert.equal(normalized.tests[1].status, "failure");
  assert.equal(normalized.tests[2].status, "skipped");
  assert.equal(normalized.tests[3].status, "flaky");
  assert.deepEqual(normalized.tests[3].attempts.map((attempt) => attempt.status), ["failed", "passed"]);
  assert.deepEqual(normalized.tests[3].attempts.map((attempt) => attempt.retry), [0, 1]);
  assert.equal(JSON.stringify(normalized).includes("must not be copied"), false);
  assert.equal(JSON.stringify(normalized).includes("fixture failure detail"), false);
});

test("rejects malformed, empty, and unrecognized report shapes with bounded errors", { skip: !implemented }, () => {
  for (const input of [
    null,
    {},
    { suites: [] },
    { suites: [{ title: "empty" }] },
    { suites: [{ specs: [{ title: "missing source", file: "tests/a.spec.ts", tests: [{}] }] }] },
    { suites: [{ specs: [{ title: "missing results", file: "tests/a.spec.ts", tests: [{ status: "expected" }] }] }] },
  ]) {
    assert.throws(() => parsePlaywrightReport(input), (error) => {
      assert.ok(error instanceof PlaywrightReportError);
      assert.ok(error.message.length <= 300);
      return true;
    });
  }
});

test("uses explicit overall status for retry outcomes and retains every attempt", { skip: !implemented }, async () => {
  const report = await fixtureReport();
  const flaky = parsePlaywrightReport(report).tests.find((entry) => entry.projectName === "chromium" && entry.titlePath.at(-1).startsWith("TC-02"));

  assert.equal(flaky.status, "flaky");
  assert.equal(flaky.attempts.length, 2);
  assert.deepEqual(flaky.attempts.map((attempt) => attempt.duration), [80, 95]);
});
