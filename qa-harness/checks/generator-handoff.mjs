const headings = ["Case", "Requirement", "Risk", "Mapped test", "Readiness", "Sources"];

function escapeMarkdown(value) {
  return String(value ?? "—").replace(/[&<>|\\`*_{}\[\]()\r\n]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === "|") return "\\|";
    if (character === "\r" || character === "\n") return " ";
    return `\\${character}`;
  });
}

function grouped(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.case, row.mappedTest, row.mappingStatus].join("\0");
    let group = groups.get(key);
    if (!group) {
      group = { case: row.case || "—", mappedTest: row.mappedTest || "—", readiness: row.mappingStatus || "unknown", requirements: new Set(), risks: new Set(), sources: new Set() };
      groups.set(key, group);
    }
    if (row.requirement) group.requirements.add(row.requirement);
    if (row.risk) group.risks.add(row.risk);
    for (const locator of (row.sources ?? "").split(/;\s*/).filter(Boolean)) group.sources.add(locator);
  }
  return [...groups.values()];
}

function rowCells(group) {
  const risks = [...group.risks];
  const riskIds = risks.map((risk) => risk.split(":", 1)[0]).join(", ");
  const riskDetails = risks.map((risk) => risk.replace(/^[^:]+:\s*/, "")).filter(Boolean);
  const riskLabel = riskIds ? `${riskIds}${riskDetails.length ? `: ${riskDetails.join("; ")}` : ""}` : "—";
  return [group.case, [...group.requirements].join(", ") || "—", riskLabel, group.mappedTest, group.readiness, [...group.sources].join("; ") || "—"];
}

function renderTable(rows) {
  return [
    `| ${headings.join(" | ")} |`,
    `| ${headings.map(() => "---").join(" | ")} |`,
    ...rows.map((group) => `| ${rowCells(group).map(escapeMarkdown).join(" | ")} |`),
  ].join("\n");
}

/** Prepare a copyable handoff without invoking or authoring for the generator. */
export function buildGeneratorHandoff(matrix) {
  const ready = grouped(matrix.rows.filter((row) => row.mappingStatus === "current" && row.case && row.mappedTest));
  const blocked = grouped(matrix.rows.filter((row) => row.mappingStatus !== "current" || !row.case || !row.mappedTest));
  const plan = `specs/${matrix.investigationId}.plan.md`;
  const lines = [
    `# Playwright generator handoff: ${escapeMarkdown(matrix.investigationId)}`,
    "",
    `Plan: ${escapeMarkdown(plan)}`,
    "",
    "## Ready cases",
    "",
    ...(ready.length ? [renderTable(ready)] : ["No cases meet the current approval and mapping requirements."]),
    "",
    "## Blocked cases",
    "",
    ...(blocked.length ? [renderTable(blocked)] : ["No blocked cases in the recorded matrix."]),
  ];

  if (ready.length) {
    const cases = ready.map((group) => `${group.case} → ${group.mappedTest}`).join("; ");
    lines.push(
      "",
      "## Copy to project's generator",
      "",
      `> Use the consuming project's Playwright test-generation agent. Read ${escapeMarkdown(plan)} and implement only these approved cases at their mapped paths: ${escapeMarkdown(cases)}. Follow the project's existing test conventions and leave the QA investigation artifacts unchanged.`,
    );
  } else if (blocked.length) {
    lines.push("", "Resolve the listed evidence, approval, or mapping blockers before handing cases to the generator.");
  }
  return `${lines.join("\n")}\n`;
}
