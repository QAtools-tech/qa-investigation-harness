const statuses = new Set(["expected", "failure", "skipped", "flaky", "unknown"]);
const classifications = ["unchanged", "regressed", "recovered", "changed", "not comparable"];

export class RunComparisonInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "RunComparisonInputError";
  }
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.length > 0;
}

function invalid(label, field) {
  throw new RunComparisonInputError(`${label} has an invalid ${field}.`);
}

function validateReport(report, label) {
  if (!object(report)) invalid(label, "report object");
  if (report.schemaVersion !== 2) invalid(label, "schema version; expected version 2");
  if (!text(report.investigationId)) invalid(label, "investigation ID");
  if (!object(report.run)) invalid(label, "run metadata");
  if (!text(report.run.runId)) invalid(label, "run ID");
  if (!text(report.run.target)) invalid(label, "target");
  if (!Array.isArray(report.run.projectNames) || report.run.projectNames.some((name) => !text(name))) invalid(label, "project names");
  if (!Array.isArray(report.tests) || !object(report.coverage) || !Array.isArray(report.coverage.links)) invalid(label, "tests or coverage links");

  for (const item of report.tests) {
    if (!object(item) || !text(item.sourcePointer) || !(item.projectName === null || text(item.projectName)) || !statuses.has(item.status)) {
      invalid(label, "test entry");
    }
  }
  for (const link of report.coverage.links) {
    if (!object(link)) invalid(label, "coverage link");
    if (link.kind === "plan-test" && (!text(link.fromId) || !text(link.status) || !text(link.toId) || !text(link.targetLocator))) {
      invalid(label, "plan-test link");
    }
    if (link.kind === "test-run" && (!text(link.fromId) || !statuses.has(link.runStatus) || !text(link.toId) || !text(link.targetLocator))) {
      invalid(label, "test-run link");
    }
  }
  return report;
}

function runMetadata(report) {
  const { run } = report;
  return {
    runId: run.runId,
    target: run.target,
    revision: run.revision ?? null,
    capturedAt: run.capturedAt ?? null,
    startedAt: run.startedAt ?? null,
    source: run.source ?? null,
    projectNames: [...run.projectNames],
  };
}

function signature(link, fields) {
  return JSON.stringify(fields.map((field) => link[field]));
}

function sideEvidence(report, caseId, projectName) {
  const { links } = report.coverage;
  const result = { evidence: null, status: null, sourcePointer: null, mappedFile: null, reason: null };
  if (!report.run.projectNames.includes(projectName)) {
    result.evidence = "project-not-included";
    result.reason = "Project is not listed in this run's metadata.";
    return result;
  }

  const mappings = links.filter((link) => link.kind === "plan-test" && link.fromId === caseId);
  if (!mappings.length) {
    result.evidence = "unmapped";
    result.reason = "No stored plan-test mapping exists for this case.";
    return result;
  }
  const uniqueMappings = new Map(mappings.map((link) => [signature(link, ["status", "toId", "targetLocator"]), link]));
  if (uniqueMappings.size > 1) {
    result.evidence = "ambiguous";
    result.reason = "Multiple distinct plan-test mappings exist for this case.";
    return result;
  }
  const mapping = uniqueMappings.values().next().value;
  result.mappedFile = mapping.toId;

  const executions = links.filter((link) => link.kind === "test-run" && link.fromId === caseId);
  const projectExecutions = [];
  let ambiguousExecution = false;
  for (const link of executions) {
    const pointers = new Set([link.toId, link.targetLocator]);
    const matchedTests = report.tests.filter((item) => pointers.has(item.sourcePointer));
    if (matchedTests.length !== 1) {
      ambiguousExecution = true;
      continue;
    }
    const item = matchedTests[0];
    if (item.projectName === projectName) {
      if (item.status !== link.runStatus) ambiguousExecution = true;
      projectExecutions.push({ link, item });
    }
  }
  if (ambiguousExecution) {
    result.evidence = "ambiguous";
    result.reason = "A test-run link could not be joined to exactly one consistent test result.";
    return result;
  }
  const uniqueExecutions = new Map(projectExecutions.map(({ link, item }) => [
    signature(link, ["runStatus", "toId", "targetLocator"]),
    { link, item },
  ]));
  if (uniqueExecutions.size > 1) {
    result.evidence = "ambiguous";
    result.reason = "Multiple distinct test-run results exist for this case and project.";
    return result;
  }
  if (!uniqueExecutions.size) {
    result.evidence = "no-result";
    result.reason = "The case is mapped, but this project has no matching test-run result.";
    return result;
  }
  const { link, item } = uniqueExecutions.values().next().value;
  result.evidence = "observed";
  result.status = item.status;
  result.sourcePointer = link.toId;
  return result;
}

function classify(before, after) {
  if (before.evidence !== "observed" || after.evidence !== "observed") return "not comparable";
  if (before.status === after.status) return "unchanged";
  if (before.status === "expected" && ["failure", "flaky"].includes(after.status)) return "regressed";
  if (["failure", "flaky"].includes(before.status) && after.status === "expected") return "recovered";
  return "changed";
}

export function buildRunComparison(beforeReport, afterReport) {
  const before = validateReport(beforeReport, "Before report");
  const after = validateReport(afterReport, "After report");
  if (before.investigationId !== after.investigationId) {
    throw new RunComparisonInputError("Run reports must belong to the same investigation.");
  }
  if (before.run.target !== after.run.target) {
    throw new RunComparisonInputError("Run reports must have exactly the same target.");
  }

  const cases = new Set();
  const projects = new Set([...before.run.projectNames, ...after.run.projectNames]);
  for (const report of [before, after]) {
    for (const link of report.coverage.links) {
      if (link.kind === "plan-test" || link.kind === "test-run") cases.add(link.fromId);
    }
  }
  const rows = [];
  for (const caseId of cases) {
    for (const projectName of projects) {
      const beforeSide = sideEvidence(before, caseId, projectName);
      const afterSide = sideEvidence(after, caseId, projectName);
      rows.push({
        caseId,
        projectName,
        before: beforeSide,
        after: afterSide,
        classification: classify(beforeSide, afterSide),
        reason: beforeSide.reason || afterSide.reason || null,
      });
    }
  }
  rows.sort((left, right) => left.caseId.localeCompare(right.caseId) || left.projectName.localeCompare(right.projectName));
  const counts = Object.fromEntries(classifications.map((value) => [value, rows.filter((row) => row.classification === value).length]));
  return {
    schemaVersion: 1,
    investigationId: before.investigationId,
    before: runMetadata(before),
    after: runMetadata(after),
    counts,
    rows,
  };
}
