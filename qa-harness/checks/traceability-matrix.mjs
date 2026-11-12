const columns = ["Requirement", "Risk", "Decision", "Case", "Mapped test", "Mapping", "Execution", "Validation", "Next action", "Sources"];

function nextMatrixAction({ requirement, risk, decision, decisionStatus, mapping, mappingStatus, execution, validation, hasFinding, selectedRun }) {
  if (requirement && !risk) return "Review requirement scope; add an evidence-backed risk link only if warranted.";
  if (risk && (!decision || decisionStatus !== "fresh" || !/^approve/i.test(decision.decision))) {
    if (decision && decisionStatus === "fresh" && /^reject/i.test(decision.decision)) return "";
    return "Review the risk and oracle; record or reconcile the human decision.";
  }
  if (mappingStatus !== "current") return "Resolve the approved risk's plan and generated-test mapping.";
  if (mapping && !selectedRun) return "Select a saved run report to inspect execution evidence.";
  if (mapping && execution === "no matching result") return "Select or generate a report that includes this mapped test.";
  if (mapping && validation === "not reviewed") return "Run Stage 5 validation for this mapped test against the approved oracle.";
  if (mapping && hasFinding) return "Review the cited Stage 5 finding; use the project's generator if a test change is warranted.";
  return "";
}

export function buildTraceabilityMatrix(coverage, { investigationId = coverage.investigationId, selectedRun = null } = {}) {
  const { requirements = [], risks = [], decisions = [], mappings = [], plans = [], findings = [], matchedTestsByMapping = {}, ambiguousMappingIndexes = [] } = coverage.evidence ?? {};
  const links = coverage.links;
  const rows = [];
  const add = (requirement, risk, mapping, mappingIndex) => {
    const decisionLinks = links.filter((link) => link.kind === "risk-decision" && link.fromId?.toUpperCase() === risk?.id.toUpperCase());
    const decision = decisions.find((item) => item.riskId.toUpperCase() === risk?.id.toUpperCase());
    const decisionStatus = decisionLinks.length > 1 || decisionLinks[0]?.status === "unresolved" ? "ambiguous" : decisionLinks[0]?.freshness ?? "unknown";
    const planLink = links.find((link) => link.kind === "decision-plan" && link.fromId === decision?.id);
    const fileLink = links.find((link) => link.kind === "plan-test" && link.fromId?.toUpperCase() === mapping?.tcId.toUpperCase());
    const duplicateTcMapping = mapping && mappings.some((candidate, index) => index !== mappingIndex && candidate.tcId.toUpperCase() === mapping.tcId.toUpperCase());
    const tests = matchedTestsByMapping[mappingIndex] ?? [];
    const validation = findings.filter((item) => item.tcId === mapping?.tcId.toUpperCase());
    const approved = decision && /^approve/i.test(decision.decision);
    const current = decisionLinks[0]?.freshness === "fresh";
    const mappingStatus = mapping ? ambiguousMappingIndexes.includes(mappingIndex) || duplicateTcMapping || decisionStatus === "ambiguous" ? "ambiguous" : !planLink || planLink.status !== "linked" ? planLink?.status ?? "unresolved" : !fileLink ? "unresolved" : fileLink.status === "missing" ? "missing file" : approved && current ? "current" : approved ? "stale or unknown approval" : "not approved" : risk ? "no mapped test" : "no linked risk";
    const execution = selectedRun ? (tests.length ? tests.map((test) => `${test.projectName ?? "unknown project"}: ${test.status}`).join("; ") : "no matching result") : "no run selected";
    const validationText = validation.length ? validation.map((item) => `${item.conformance}: ${item.finding} (${item.locator})`).join("; ") : "not reviewed";
    rows.push({
      requirement: requirement ? `${requirement.id}: ${requirement.title}` : "",
      risk: risk ? `${risk.id}: ${risk.text}` : "",
      decision: decision ? `${decision.id}: ${decision.decision} (${decisionStatus})` : decisionStatus === "ambiguous" ? "ambiguous decisions" : "no decision",
      case: mapping ? mapping.tcId : "",
      mappedTest: mapping?.file ?? "",
      mappingStatus,
      execution,
      validation: validationText,
      nextAction: nextMatrixAction({ requirement, risk, decision, decisionStatus, mapping, mappingStatus, execution, validation: validationText, hasFinding: validation.length > 0, selectedRun }),
      sources: [requirement?.locator, risk?.locator, decision?.locator, mapping?.locator, plans.find((item) => item.tcId.toUpperCase() === mapping?.tcId.toUpperCase())?.locator, validation[0]?.recordLocator, validation[0]?.locator].filter(Boolean).join("; "),
      _sort: [requirement?.id ?? "", risk?.id ?? "", mapping?.tcId ?? "", mapping?.file ?? ""],
    });
  };

  for (const requirement of requirements) {
    const linked = risks.filter((risk) => risk.requirementIds.some((id) => id.toUpperCase() === requirement.id.toUpperCase()));
    if (!linked.length) add(requirement, null, null, -1);
    for (const risk of linked) {
      const riskMappings = mappings.map((mapping, index) => ({ mapping, index })).filter(({ mapping }) => mapping.riskId.toUpperCase() === risk.id.toUpperCase());
      if (!riskMappings.length) add(requirement, risk, null, -1);
      for (const { mapping, index } of riskMappings) add(requirement, risk, mapping, index);
    }
  }
  for (const risk of risks.filter((item) => !item.requirementIds.some((id) => requirements.some((req) => req.id.toUpperCase() === id.toUpperCase())))) {
    const riskMappings = mappings.map((mapping, index) => ({ mapping, index })).filter(({ mapping }) => mapping.riskId.toUpperCase() === risk.id.toUpperCase());
    if (!riskMappings.length) add(null, risk, null, -1);
    for (const { mapping, index } of riskMappings) add(null, risk, mapping, index);
  }
  rows.sort((a, b) => a._sort.join("\0").localeCompare(b._sort.join("\0")));
  for (const row of rows) delete row._sort;
  return { investigationId, selectedRun, rows };
}

function markdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function csv(value) {
  const text = String(value ?? "").replace(/^[\s\u0000-\u001f]*([=+@]|-)/, "'$&");
  return `"${text.replaceAll('"', '""')}"`;
}

export function renderTraceabilityMatrix(matrix) {
  const data = matrix.rows.map((row) => columns.map((column) => row[column === "Mapped test" ? "mappedTest" : column === "Mapping" ? "mappingStatus" : column === "Execution" ? "execution" : column === "Validation" ? "validation" : column === "Next action" ? "nextAction" : column === "Sources" ? "sources" : column.toLowerCase()] ?? ""));
  const markdownText = [
    `# Traceability matrix: ${markdown(matrix.investigationId)}`, "",
    `Selected run: ${markdown(matrix.selectedRun?.runId ?? "no run selected")}${matrix.selectedRun ? ` · Target: ${markdown(matrix.selectedRun.target)} · Revision: ${markdown(matrix.selectedRun.revision ?? "unknown")}` : ""}`, "",
    `| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`,
    ...(data.length ? data.map((row) => `| ${row.map(markdown).join(" | ")} |`) : [`| ${columns.map(() => "—").join(" | ")} |`]), "",
  ].join("\n");
  return { markdown: markdownText, csv: [columns, ...data].map((row) => row.map(csv).join(",")).join("\r\n") + "\r\n" };
}
