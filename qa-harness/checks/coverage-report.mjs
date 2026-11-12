import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const localIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const tcPattern = /^TC-\d+$/i;

function cellsFromTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "\\" && body[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (body[index] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += body[index];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizedHeader(value) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function isSeparator(cells) {
  return cells?.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function markdownTables(content) {
  const lines = content.split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length; index += 1) {
    const headers = cellsFromTableLine(lines[index]);
    if (!headers || !isSeparator(cellsFromTableLine(lines[index + 1]))) continue;
    const rows = [];
    let cursor = index + 2;
    while (cursor < lines.length) {
      const cells = cellsFromTableLine(lines[cursor]);
      if (!cells) break;
      if (!isSeparator(cells)) rows.push({ cells, line: cursor + 1 });
      cursor += 1;
    }
    tables.push({ headers: headers.map(normalizedHeader), rows, line: index + 1 });
    index = cursor;
  }
  return tables;
}

function tableHas(table, required) {
  return required.every((header) => table.headers.includes(normalizedHeader(header)));
}

function rowObject(table, row) {
  return Object.fromEntries(table.headers.map((header, index) => [header, row.cells[index] ?? ""]));
}

function lineLocator(file, line) {
  return `${file}:${line}`;
}

function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function safeRealPath(rootReal, target) {
  const actual = await realpath(target);
  if (!inside(rootReal, actual)) throw new Error("Resolved evidence path escapes the supplied project root.");
  return actual;
}

async function readOptionalEvidence(rootReal, root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!inside(root, target)) throw new Error("Evidence path escapes the supplied project root.");
  try {
    const actual = await safeRealPath(rootReal, target);
    const metadata = await stat(actual);
    if (!metadata.isFile()) return null;
    return { text: await readFile(actual, "utf8"), actual };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseRequirements(content, file) {
  const table = markdownTables(content).find((item) => tableHas(item, ["ID", "Kind", "Title or claim", "Source ID", "Location", "Revision"]));
  if (!table) return [];
  return table.rows.map(({ cells, line }) => {
    const row = rowObject(table, { cells, line });
    return {
      id: row.id,
      kind: row.kind,
      title: row["title or claim"],
      sourceId: row["source id"],
      location: row.location,
      revision: row.revision,
      locator: lineLocator(file, line),
    };
  }).filter((item) => item.id && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item.id));
}

function parseRisks(content, file) {
  const tables = markdownTables(content);
  const table = tables.find((item) => tableHas(item, ["ID", "Risk", "Proposed oracle", "Status"]));
  const risks = table ? table.rows.map(({ cells, line }) => {
    const row = rowObject(table, { cells, line });
    const refs = row["requirement ids"]
      ? row["requirement ids"].split(/[,;\s]+/).filter(Boolean)
      : [];
    return {
      id: row.id,
      step: row["step/state"] ?? "",
      text: row.risk,
      oracle: row["proposed oracle"],
      status: row.status,
      revision: row.revision || null,
      requirementIds: refs,
      locator: lineLocator(file, line),
    };
  }).filter((item) => item.id && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item.id)) : [];

  const decisions = [];
  const mappings = [];
  const decisionTable = tables.find((item) => tableHas(item, ["Decision ID", "Risk ID", "Decision", "Date", "Reviewed risk/oracle", "Dependency revision"]));
  if (decisionTable) {
    for (const { cells, line } of decisionTable.rows) {
      const row = rowObject(decisionTable, { cells, line });
      if (row["decision id"] && row["risk id"]) {
        decisions.push({
          id: row["decision id"], riskId: row["risk id"], decision: row.decision,
          date: row.date, reviewed: row["reviewed risk/oracle"], dependency: row["dependency revision"],
          locator: lineLocator(file, line),
        });
      }
    }
  }

  const mappingTables = tables.filter((item) => tableHas(item, ["Risk ID", "TC ID", "File"]));
  for (const mappingTable of mappingTables) {
    for (const { cells, line } of mappingTable.rows) {
      const row = rowObject(mappingTable, { cells, line });
      if (row["risk id"] && row["tc id"] && row.file) {
        mappings.push({ riskId: row["risk id"], tcId: row["tc id"], file: row.file, locator: lineLocator(file, line) });
      }
    }
  }
  return { risks, decisions, mappings };
}

function parsePlanEntries(content, file) {
  const entries = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^#{1,6}\s+.*?\b(TC-\d+)\s*:\s*(.+?)\s*$/i);
    if (!match) return;
    const title = match[2].trim();
    entries.push({
      tcId: match[1].toUpperCase(),
      title,
      titlePath: title.split(" › ").map((part) => part.trim()),
      locator: lineLocator(file, index + 1),
    });
  });
  return entries;
}

export function normalizeRelativeFile(projectRoot, value, pathApi = path) {
  if (typeof value !== "string" || !value.trim()) return null;
  const portable = value.trim().replace(/[\\/]/g, pathApi.sep);
  const resolved = pathApi.resolve(projectRoot, portable);
  const relative = pathApi.relative(projectRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative)) return null;
  return relative.split(pathApi.sep).join("/").replace(/^\.\//, "");
}

function testTcIds(test) {
  const matches = new Set();
  for (const title of test.titlePath ?? []) {
    const regex = /(?:^|[^A-Za-z0-9_-])(TC-\d+)(?=$|[^A-Za-z0-9_-])/gi;
    for (const match of title.matchAll(regex)) matches.add(match[1].toUpperCase());
  }
  return [...matches];
}

function dependencyFreshness(decision, evidence) {
  const dependencies = decision.dependency.split(/[;,]+/).map((value) => value.trim()).filter(Boolean);
  let unknown = dependencies.length === 0;
  for (const dependency of dependencies) {
    const [, file, revision] = dependency.match(/^([^@]+)@(.+)$/) ?? [];
    const current = evidence.get(file);
    if (current === undefined) {
      unknown = true;
      continue;
    }
    if (/^sha256:[a-f0-9]{64}$/i.test(revision)) {
      if (createHash("sha256").update(current).digest("hex") !== revision.slice(7).toLowerCase()) return "stale";
      continue;
    }
    const date = file === "flow-model.md" ? current.match(/^Model(?:l)?ed:\s*(\d{4}-\d{2}-\d{2})[ \t]*$/im)?.[1] : null;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(revision) && date !== revision) return "stale";
    unknown = true;
  }
  return unknown ? "unknown" : "fresh";
}

function combinedFreshness(decision, evidence, risk) {
  const dependency = dependencyFreshness(decision, evidence);
  const exactRisk = decision.reviewed.match(/(?:^|;\s*)Risk:\s*(.+?);\s*Oracle:/i)?.[1];
  const exactOracle = decision.reviewed.match(/(?:^|;\s*)Oracle:\s*(.+?)\s*$/i)?.[1];
  const reviewedRevision = decision.reviewed.match(new RegExp(`\\b${risk.id}\\s+revision\\s+([A-Za-z0-9._-]+)`, "i"))?.[1];
  if (dependency === "stale" || (exactRisk && exactRisk.trim() !== risk.text) ||
      (exactOracle && exactOracle.trim() !== risk.oracle) ||
      (reviewedRevision && risk.revision && reviewedRevision !== risk.revision)) return "stale";
  const reviewed = (exactRisk && exactOracle) || (reviewedRevision && risk.revision);
  return dependency === "fresh" && reviewed ? "fresh" : "unknown";
}

async function sourceFileExists(root, rootReal, mappedFile) {
  const relative = normalizeRelativeFile(root, mappedFile);
  if (!relative) throw new Error("Mapped source file path escapes the selected project root.");
  const target = path.resolve(root, relative);
  try {
    const actual = await safeRealPath(rootReal, target);
    return (await stat(actual)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function tableFindings(content) {
  const tables = markdownTables(content);
  const table = tables.find((item) => tableHas(item, ["TC ID", "Oracle conformance", "Finding", "Source locator"]));
  if (!table) return [];
  return table.rows.map(({ cells, line }) => {
    const row = rowObject(table, { cells, line });
    return {
      tcId: row["tc id"].toUpperCase(),
      conformance: row["oracle conformance"],
      finding: row.finding.slice(0, 1000),
      locator: row["source locator"].slice(0, 1000),
      recordLocator: lineLocator("qa-artifacts/validation.md", line),
    };
  }).filter((entry) => tcPattern.test(entry.tcId) && entry.conformance && entry.finding && entry.locator);
}

function addGap(gaps, status, fromId, toId, sourceLocator, reason) {
  gaps.push({ status, fromId: fromId ?? null, toId: toId ?? null, sourceLocator: sourceLocator ?? null, reason });
}

/** Read one investigation and reconcile it to a normalized Playwright run. */
export async function buildCoverage(rootDirectory, investigationId, run, { includeMatrixEvidence = false } = {}) {
  if (typeof investigationId !== "string" || !localIdPattern.test(investigationId)) {
    throw new Error("Invalid investigation ID; use a safe local ID without path separators.");
  }
  const root = path.resolve(rootDirectory);
  const rootReal = await realpath(root);
  const artifactRoot = path.resolve(root, "qa-artifacts");
  const artifactDir = path.resolve(artifactRoot, investigationId);
  const planPath = path.resolve(root, "specs", `${investigationId}.plan.md`);
  if (!inside(root, artifactDir) || !inside(artifactRoot, artifactDir) || !inside(root, planPath)) {
    throw new Error("Investigation ID resolves outside its expected artifact paths.");
  }

  const [investigationFile, risksFile, validationFile, planFile, modelFile, explorationFile] = await Promise.all([
    readOptionalEvidence(rootReal, root, path.join("qa-artifacts", investigationId, "investigation.md")),
    readOptionalEvidence(rootReal, root, path.join("qa-artifacts", investigationId, "risks.md")),
    readOptionalEvidence(rootReal, root, path.join("qa-artifacts", investigationId, "validation.md")),
    readOptionalEvidence(rootReal, root, path.join("specs", `${investigationId}.plan.md`)),
    readOptionalEvidence(rootReal, root, path.join("qa-artifacts", investigationId, "flow-model.md")),
    readOptionalEvidence(rootReal, root, path.join("qa-artifacts", investigationId, "exploration.md")),
  ]);
  const investigationContent = investigationFile?.text ?? "";
  const risksContent = risksFile?.text ?? "";
  const planContent = planFile?.text ?? "";
  const decisionEvidence = new Map([
    ["investigation.md", investigationFile?.text],
    ["flow-model.md", modelFile?.text],
    ["exploration.md", explorationFile?.text],
  ]);
  const investigationLocator = `qa-artifacts/${investigationId}/investigation.md`;
  const risksLocator = `qa-artifacts/${investigationId}/risks.md`;
  const planLocator = `specs/${investigationId}.plan.md`;
  const requirements = parseRequirements(investigationContent, investigationLocator);
  const { risks, decisions, mappings } = parseRisks(risksContent, risksLocator);
  const plans = parsePlanEntries(planContent, planLocator);
  const findings = validationFile ? tableFindings(validationFile.text) : [];
  const links = [];
  const gaps = [];
  const unresolvedMappings = [];
  const orphanTests = [];

  if (!investigationFile) addGap(gaps, "missing evidence", investigationId, null, investigationLocator, "Investigation record is missing.");
  if (!risksFile) addGap(gaps, "missing evidence", investigationId, null, risksLocator, "Risk and decision record is missing.");
  if (!planFile) addGap(gaps, "missing evidence", investigationId, null, planLocator, "Generator plan is missing.");

  const riskById = new Map(risks.map((risk) => [risk.id.toUpperCase(), risk]));
  const requirementById = new Map(requirements.map((requirement) => [requirement.id.toUpperCase(), requirement]));
  const planByTc = new Map();
  for (const entry of plans) {
    const key = entry.tcId.toUpperCase();
    if (!planByTc.has(key)) planByTc.set(key, []);
    planByTc.get(key).push(entry);
  }

  for (const requirement of requirements) {
    const linkedRisks = risks.filter((risk) => risk.requirementIds.some((id) => id.toUpperCase() === requirement.id.toUpperCase()));
    if (linkedRisks.length === 0) {
      const link = { kind: "requirement-risk", status: "missing", fromId: requirement.id, toId: null, sourceLocator: requirement.locator, reason: "No explicit requirement ID reference exists on a risk row." };
      links.push(link);
      addGap(gaps, "missing link", requirement.id, null, requirement.locator, link.reason);
      continue;
    }
    for (const risk of linkedRisks) links.push({ kind: "requirement-risk", status: "linked", fromId: requirement.id, toId: risk.id, sourceLocator: risk.locator, targetLocator: requirement.locator });
  }

  for (const risk of risks) {
    for (const requirementId of risk.requirementIds) {
      if (!requirementById.has(requirementId.toUpperCase())) {
        const item = { riskId: risk.id, requirementId, sourceLocator: risk.locator, reason: "unknown requirement ID" };
        unresolvedMappings.push(item);
        addGap(gaps, "unresolved", risk.id, requirementId, risk.locator, item.reason);
      }
    }
    const riskDecisions = decisions.filter((decision) => decision.riskId.toUpperCase() === risk.id.toUpperCase());
    if (riskDecisions.length === 0) {
      const link = { kind: "risk-decision", status: "missing", fromId: risk.id, toId: null, sourceLocator: risk.locator, reason: "No explicit human decision row references this risk." };
      links.push(link);
      addGap(gaps, "missing link", risk.id, null, risk.locator, link.reason);
    } else if (riskDecisions.length > 1) {
      const item = { riskId: risk.id, sourceLocator: risk.locator, reason: "multiple decision rows reference this risk" };
      unresolvedMappings.push(item);
      links.push({ kind: "risk-decision", status: "unresolved", fromId: risk.id, toId: null, sourceLocator: risk.locator, reason: item.reason });
    } else {
      const decision = riskDecisions[0];
      const freshness = combinedFreshness(decision, decisionEvidence, risk);
      links.push({ kind: "risk-decision", status: freshness === "fresh" ? "linked" : freshness, fromId: risk.id, toId: decision.id, decision: decision.decision, sourceLocator: risk.locator, targetLocator: decision.locator, freshness });
      if (freshness === "stale") addGap(gaps, "stale", risk.id, decision.id, decision.locator, "The reviewed risk, oracle, or dependency differs from current evidence.");
      else if (freshness === "unknown") addGap(gaps, "unknown freshness", risk.id, decision.id, decision.locator, "Decision freshness could not be compared from recorded revisions.");
    }
  }

  for (const decision of decisions) {
    const decisionRisk = riskById.get(decision.riskId.toUpperCase());
    if (!decisionRisk) {
      unresolvedMappings.push({ decisionId: decision.id, riskId: decision.riskId, sourceLocator: decision.locator, reason: "unknown risk ID" });
      continue;
    }
    const decisionMappings = mappings.filter((mapping) => mapping.riskId.toUpperCase() === decision.riskId.toUpperCase());
    if (decisionMappings.length === 0) {
      const link = { kind: "decision-plan", status: "missing", fromId: decision.id, toId: null, sourceLocator: decision.locator, reason: "No generated mapping references the decided risk." };
      links.push(link);
      addGap(gaps, "missing link", decision.id, null, decision.locator, link.reason);
    } else if (decisionMappings.length > 1) {
      const item = { decisionId: decision.id, riskId: decision.riskId, sourceLocator: decision.locator, reason: "multiple mapping targets" };
      unresolvedMappings.push(item);
      links.push({ kind: "decision-plan", status: "unresolved", fromId: decision.id, toId: null, sourceLocator: decision.locator, reason: item.reason });
    } else {
      const mapping = decisionMappings[0];
      const planEntries = planByTc.get(mapping.tcId.toUpperCase()) ?? [];
      if (planEntries.length !== 1) {
        const reason = planEntries.length === 0 ? "unknown TC ID" : "multiple plan entries for TC ID";
        unresolvedMappings.push({ decisionId: decision.id, tcId: mapping.tcId, sourceLocator: mapping.locator, reason });
        links.push({ kind: "decision-plan", status: "unresolved", fromId: decision.id, toId: mapping.tcId, sourceLocator: decision.locator, targetLocator: mapping.locator, reason });
      } else {
        links.push({ kind: "decision-plan", status: "linked", fromId: decision.id, toId: mapping.tcId, sourceLocator: decision.locator, targetLocator: mapping.locator });
      }
    }
  }

  const matchedTestsByMapping = new Map(mappings.map((_, index) => [index, []]));
  const ambiguousMappingIndexes = new Set();
  for (const reportTest of run?.tests ?? []) {
    const ids = testTcIds(reportTest);
    const exactIdMappings = mappings
      .map((mapping, index) => ({ mapping, index }))
      .filter(({ mapping }) => ids.includes(mapping.tcId.toUpperCase()));

    if (ids.length > 1) {
      for (const id of ids) {
        const idMappings = mappings.map((mapping, index) => ({ mapping, index })).filter(({ mapping }) => mapping.tcId.toUpperCase() === id);
        if (idMappings.length === 0) unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcId: id, reason: "unknown TC ID" });
        for (const { index } of idMappings) ambiguousMappingIndexes.add(index);
      }
      unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcIds: ids, reason: "multiple TC identifiers in one report test title" });
      addGap(gaps, "unresolved", ids.join(", "), null, reportTest.sourcePointer, "One report test title contains multiple TC identifiers.");
      continue;
    }

    if (ids.length === 1) {
      if (exactIdMappings.length === 0) {
        unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcId: ids[0], reason: "unknown TC ID" });
      } else if (exactIdMappings.length > 1) {
        for (const { index } of exactIdMappings) ambiguousMappingIndexes.add(index);
        unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcId: ids[0], reason: "multiple mapping targets" });
        addGap(gaps, "unresolved", ids[0], null, reportTest.sourcePointer, "One TC identifier references multiple generated mapping rows.");
      } else {
        const { index, mapping } = exactIdMappings[0];
        const file = normalizeRelativeFile(root, reportTest.file);
        if (file && file === normalizeRelativeFile(root, mapping.file)) {
          matchedTestsByMapping.get(index).push(reportTest);
        } else {
          const reason = "report file differs from mapped file";
          unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcId: ids[0], reason });
          addGap(gaps, "unresolved", ids[0], mapping.file, reportTest.sourcePointer, reason);
        }
      }
      continue;
    }

    const titleMatches = [];
    for (const [index, mapping] of mappings.entries()) {
      const entries = planByTc.get(mapping.tcId.toUpperCase()) ?? [];
      if (entries.length !== 1) continue;
      const reportFile = normalizeRelativeFile(root, reportTest.file);
      const mappingFile = normalizeRelativeFile(root, mapping.file);
      if (reportFile && reportFile === mappingFile && JSON.stringify(reportTest.titlePath ?? []) === JSON.stringify(entries[0].titlePath)) {
        titleMatches.push({ index, mapping });
      }
    }
    if (titleMatches.length > 1) {
      for (const { index } of titleMatches) ambiguousMappingIndexes.add(index);
      unresolvedMappings.push({ testLocator: reportTest.sourcePointer, tcIds: titleMatches.map(({ mapping }) => mapping.tcId), reason: "one report test matches multiple mappings" });
      addGap(gaps, "unresolved", null, null, reportTest.sourcePointer, "One report test matches multiple generated mappings.");
    } else if (titleMatches.length === 1) {
      matchedTestsByMapping.get(titleMatches[0].index).push(reportTest);
    } else {
      orphanTests.push({ testLocator: reportTest.sourcePointer, titlePath: reportTest.titlePath, file: reportTest.file, reason: "No exact mapping match." });
    }
  }

  for (const [mappingIndex, mapping] of mappings.entries()) {
    if (!tcPattern.test(mapping.tcId)) {
      unresolvedMappings.push({ tcId: mapping.tcId, sourceLocator: mapping.locator, reason: "invalid TC ID" });
      continue;
    }
    if (mappings.filter((candidate) => candidate.tcId.toUpperCase() === mapping.tcId.toUpperCase()).length > 1) {
      unresolvedMappings.push({ tcId: mapping.tcId, sourceLocator: mapping.locator, reason: "multiple mapping targets" });
      addGap(gaps, "unresolved", mapping.tcId, mapping.file, mapping.locator, "Multiple generated mapping rows target this TC ID.");
      continue;
    }
    const planEntries = planByTc.get(mapping.tcId.toUpperCase()) ?? [];
    if (planEntries.length === 0) {
      addGap(gaps, "missing link", mapping.tcId, null, mapping.locator, "Generated mapping references a TC ID absent from the plan.");
      unresolvedMappings.push({ tcId: mapping.tcId, sourceLocator: mapping.locator, reason: "unknown TC ID" });
      continue;
    }
    if (planEntries.length > 1) {
      unresolvedMappings.push({ tcId: mapping.tcId, sourceLocator: mapping.locator, reason: "multiple plan entries for TC ID" });
      continue;
    }
    const fileExists = await sourceFileExists(root, rootReal, mapping.file);
    links.push({
      kind: "plan-test",
      status: fileExists ? "linked" : "missing",
      fromId: mapping.tcId,
      toId: mapping.file,
      sourceLocator: planEntries[0].locator,
      targetLocator: mapping.locator,
      reason: fileExists ? undefined : "Mapped test source file does not exist under the project root.",
    });
    if (!fileExists) addGap(gaps, "missing test", mapping.tcId, mapping.file, mapping.locator, "Mapped test source file does not exist under the project root.");
    if (ambiguousMappingIndexes.has(mappingIndex)) continue;
    const candidates = matchedTestsByMapping.get(mappingIndex) ?? [];
    if (!run) continue;
    if (candidates.length === 0) {
      addGap(gaps, fileExists ? "missing execution evidence" : "missing test", mapping.tcId, mapping.file, mapping.locator, fileExists ? "The mapped test file exists but no matching test appears in the selected run." : "The mapped test file and matching run result are absent.");
      continue;
    }
    const matchingFindings = findings.filter((finding) => finding.tcId === mapping.tcId.toUpperCase());
    const finding = matchingFindings.length === 1 ? matchingFindings[0] : null;
    for (const reportTest of candidates) {
      links.push({
        kind: "test-run",
        status: "linked",
        fromId: mapping.tcId,
        toId: reportTest.sourcePointer,
        runStatus: reportTest.status,
        conformance: finding?.conformance ?? "not-reviewed",
        conformanceFinding: finding?.finding,
        conformanceLocator: finding?.locator,
        sourceLocator: mapping.locator,
        targetLocator: reportTest.sourcePointer,
      });
    }
  }

  const mappedTcIds = new Set(mappings.map((mapping) => mapping.tcId.toUpperCase()));
  for (const planEntry of plans) {
    if (!mappedTcIds.has(planEntry.tcId.toUpperCase())) {
      const reason = "Plan entry has no generated mapping.";
      links.push({ kind: "plan-mapping", status: "missing", fromId: planEntry.tcId, toId: null, sourceLocator: planEntry.locator, reason });
      addGap(gaps, "missing link", planEntry.tcId, null, planEntry.locator, reason);
    }
  }

  for (const finding of findings) {
    if (!mappings.some((mapping) => mapping.tcId.toUpperCase() === finding.tcId)) {
      gaps.push({ status: "unresolved", fromId: finding.tcId, toId: null, sourceLocator: finding.recordLocator, reason: "Validation record references a TC ID without a generated mapping." });
    }
  }

  return {
    investigationId,
    links,
    orphanTests,
    unresolvedMappings,
    gaps,
    ...(includeMatrixEvidence ? { evidence: { requirements, risks, decisions, mappings, plans, findings, matchedTestsByMapping: Object.fromEntries([...matchedTestsByMapping].map(([index, tests]) => [index, tests])), ambiguousMappingIndexes: [...ambiguousMappingIndexes] } } : {}),
  };
}
