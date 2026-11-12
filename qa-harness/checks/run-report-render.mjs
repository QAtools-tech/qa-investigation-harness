const statuses = ["expected", "failure", "skipped", "flaky", "unknown"];

function testStartTime(test) {
  return test.attempts?.find((attempt) => typeof attempt.startTime === "string")?.startTime ?? null;
}

function timeValue(value) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function boundedText(value, limit = 2000) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").slice(0, limit);
}

function markdownText(value) {
  const text = boundedText(String(value ?? "—")).replace(/[\r\n]+/g, " ");
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|]/g, "\\$&");
}

function countOutcomes(tests) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const test of tests) counts[statuses.includes(test.status) ? test.status : "unknown"] += 1;
  return counts;
}

export function buildTriage(run, coverage) {
  return (run.tests ?? [])
    .filter((test) => test.status === "failure" || test.status === "flaky")
    .map((test) => ({
      order: test.order,
      titlePath: (test.titlePath ?? []).map((part) => boundedText(part, 500)),
      projectName: boundedText(test.projectName ?? "unknown", 200),
      observed: {
        status: test.status,
        expectedStatus: test.expectedStatus ?? null,
        attempts: (test.attempts ?? []).map((attempt) => ({
          status: attempt.status,
          duration: attempt.duration,
          retry: attempt.retry,
          startTime: attempt.startTime,
          attachments: (attempt.attachments ?? []).map((attachment) => ({
            name: boundedText(attachment.name ?? "Attachment", 500),
            contentType: boundedText(attachment.contentType ?? "", 200) || null,
            path: attachment.availability === "available" && typeof attachment.path === "string"
              ? attachment.path
              : null,
            availability: attachment.availability === "available" && typeof attachment.path === "string" ? "available" : "unavailable",
          })),
        })),
        source: {
          file: boundedText(test.file ?? "", 2000),
          line: test.line ?? null,
          column: test.column ?? null,
          reportPointer: boundedText(test.sourcePointer ?? "", 2000),
        },
      },
      possibleCauses: [],
      timelineStart: testStartTime(test),
    }))
    .sort((left, right) => timeValue(left.timelineStart) - timeValue(right.timelineStart) || left.order - right.order)
    .map(({ timelineStart, ...entry }) => entry);
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function attachmentUrl(prefix, filePath) {
  const segments = [prefix, filePath].filter(Boolean).flatMap((value) => value.split("/")).filter(Boolean);
  return segments.map(encodePathSegment).join("/");
}

function markdownReport(json, attachmentLinkPrefix) {
  const lines = [
    `# Playwright run report: ${markdownText(json.run.runId ?? "unknown run")}`,
    "",
    `Investigation: ${markdownText(json.investigationId)}`,
    `Target: ${markdownText(json.run.target ?? "unknown")}`,
    `Revision: ${markdownText(json.run.revision ?? "unknown")}`,
    `Captured: ${markdownText(json.run.capturedAt ?? "unknown")}`,
    `Started: ${markdownText(json.run.startedAt ?? "unknown")}`,
    `Report source: ${markdownText(json.run.source ?? "unknown")}`,
    "",
    "## Raw runner outcomes",
    "",
    "| Category | Count |",
    "|---|---:|",
    ...statuses.map((status) => `| ${status} | ${json.outcomeCounts[status]} |`),
    "",
    "These are runner outcomes only. They do not verify that a test checked its oracle.",
    "",
    "## Coverage links",
    "",
    "| Link | Status | From | To | Runner status | Oracle conformance | Finding | Finding source | Evidence |",
    "|---|---|---|---|---|---|---|---|---|",
    ...(json.coverage.links.length
      ? json.coverage.links.map((link) => `| ${markdownText(link.kind)} | ${markdownText(link.status)} | ${markdownText(link.fromId)} | ${markdownText(link.toId)} | ${markdownText(link.runStatus)} | ${markdownText(link.conformance)} | ${markdownText(link.conformanceFinding)} | ${markdownText(link.conformanceLocator)} | ${markdownText(link.sourceLocator)} |`)
      : ["| — | — | — | — | — | — | — | — | No links recorded |"]),
    "",
    "## Gaps",
    "",
    "| Status | From | To | Evidence | Reason |",
    "|---|---|---|---|---|",
    ...(json.coverage.gaps.length
      ? json.coverage.gaps.map((gap) => `| ${markdownText(gap.status)} | ${markdownText(gap.fromId)} | ${markdownText(gap.toId)} | ${markdownText(gap.sourceLocator)} | ${markdownText(gap.reason)} |`)
      : ["| — | — | — | — | No gaps recorded |"]),
    "",
    "## Unresolved mappings",
    "",
    ...(json.coverage.unresolvedMappings.length
      ? json.coverage.unresolvedMappings.map((item) => `- ${markdownText(item.tcId ?? item.riskId ?? item.decisionId ?? "Unresolved")}: ${markdownText(item.reason)} (${markdownText(item.sourceLocator ?? item.testLocator)})`)
      : ["- None recorded."]),
    "",
    "## Orphan tests",
    "",
    ...(json.coverage.orphanTests.length
      ? json.coverage.orphanTests.map((item) => `- ${markdownText(item.titlePath?.join(" › ") ?? "Unmapped test")}: ${markdownText(item.file)} (${markdownText(item.testLocator)}); ${markdownText(item.reason)}`)
      : ["- None recorded."]),
    "",
    "## Triage timeline",
    "",
    ...(json.triage.length
      ? json.triage.map((entry) => {
        const attempts = entry.observed.attempts.map((attempt) => `retry ${attempt.retry}: ${attempt.status}${attempt.duration === null ? "" : ` (${attempt.duration} ms)`}`).join(", ") || "no attempt detail";
        const lines = [`- **${markdownText(entry.observed.status)}** ${markdownText(entry.titlePath.join(" › "))} — ${markdownText(entry.projectName)}; observed at ${markdownText(entry.observed.source.file)}:${markdownText(entry.observed.source.line)} (${markdownText(entry.observed.source.reportPointer)}); attempts: ${markdownText(attempts)}. Possible causes: none recorded.`];
        for (const attempt of entry.observed.attempts) {
          for (const attachment of attempt.attachments ?? []) {
            const name = markdownText(attachment.name || "Attachment");
            const contentType = markdownText(attachment.contentType || "unknown type");
            const reference = attachment.path && attachment.availability === "available"
              ? `[${name}](${attachmentUrl(attachmentLinkPrefix, attachment.path)}) (${contentType})`
              : `${name} (${contentType}; file unavailable)`;
            lines.push(`  - retry ${markdownText(attempt.retry)}: ${reference}`);
          }
        }
        return lines.join("\n");
      })
      : ["- No failure or flaky execution entries were reported."]),
    "",
    "## Limitations",
    "",
    ...json.limitations.map((limitation) => `- ${markdownText(limitation)}`),
    "",
  ];
  return lines.join("\n");
}

export function renderRunReport(run, coverage, { attachmentLinkPrefix = "" } = {}) {
  const normalizedTests = (run.tests ?? []).map((test) => ({
    ...test,
    status: statuses.includes(test.status) ? test.status : "unknown",
    titlePath: (test.titlePath ?? []).map((part) => boundedText(part, 500)),
    file: boundedText(test.file ?? "", 2000),
    attempts: (test.attempts ?? []).map((attempt) => ({
      ...attempt,
      attachments: (attempt.attachments ?? []).map((attachment) => ({
        name: boundedText(attachment.name ?? "Attachment", 500),
        contentType: boundedText(attachment.contentType ?? "", 200) || null,
        path: attachment.availability === "available" && typeof attachment.path === "string"
          ? attachment.path
          : null,
        availability: attachment.availability === "available" && typeof attachment.path === "string" ? "available" : "unavailable",
      })),
    })),
  }));
  const safeRun = {
    runId: boundedText(run.metadata?.runId ?? "", 500) || null,
    target: boundedText(run.metadata?.target ?? "", 500) || null,
    revision: boundedText(run.metadata?.revision ?? "", 500) || null,
    capturedAt: boundedText(run.metadata?.capturedAt ?? "", 100) || null,
    startedAt: boundedText(run.metadata?.startedAt ?? "", 100) || null,
    source: boundedText(run.metadata?.source ?? "", 1000) || null,
    projectNames: (run.metadata?.projectNames ?? []).map((name) => boundedText(name, 200)),
  };
  const triage = buildTriage({ tests: normalizedTests }, coverage);
  const json = {
    schemaVersion: 2,
    investigationId: coverage.investigationId,
    run: safeRun,
    outcomeCounts: countOutcomes(normalizedTests),
    tests: normalizedTests,
    coverage: {
      links: coverage.links,
      gaps: coverage.gaps,
      unresolvedMappings: coverage.unresolvedMappings,
      orphanTests: coverage.orphanTests,
    },
    triage,
    limitations: [
      "Runner status does not verify an oracle.",
      "Oracle conformance remains not-reviewed unless an explicit validation finding with a source locator is recorded.",
      "Possible causes are hypotheses and none were supplied by a human reviewer.",
    ],
  };
  return { json, markdown: markdownReport(json, attachmentLinkPrefix) };
}
