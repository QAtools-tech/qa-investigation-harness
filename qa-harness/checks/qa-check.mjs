import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const reservedNames = new Set([
  "CON", "PRN", "AUX", "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);
const allowedRiskStatuses = new Set(["PROPOSED", "APPROVED", "REJECTED"]);
const requiredInvestigationSections = [
  "Sources",
  "Cases and requirements",
  "Missing inputs",
  "Run evidence",
  "Conflicting claims",
  "Import history",
];

function lineNumber(lines, predicate, fallback = 1) {
  const index = lines.findIndex(predicate);
  return index < 0 ? fallback : index + 1;
}

function diagnostic(root, filePath, line, code, message) {
  const relativePath = path.relative(root, filePath).split(path.sep).join("/") || ".";
  return {
    path: relativePath,
    line,
    code,
    message,
  };
}

function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "\\" && body[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (body[index] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += body[index];
    }
  }
  cells.push(current.trim());
  return cells;
}

function isSeparator(cells) {
  return cells?.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizedHeader(cells) {
  return cells?.map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim()) ?? [];
}

function hasHeader(cells, expected) {
  const actual = normalizedHeader(cells);
  return expected.every((cell, index) => actual[index] === cell.toLowerCase());
}

async function readLines(root, filePath, output) {
  try {
    const metadata = await lstat(filePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      output.push(diagnostic(root, filePath, 1, "ARTIFACT_FILE_UNSAFE", "Expected a regular file; symbolic links and non-file paths are not followed."));
      return null;
    }
    const text = await readFile(filePath, "utf8");
    return text.replace(/^\uFEFF/, "").split(/\r?\n/);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    output.push(diagnostic(root, filePath, 1, "FILE_READ_FAILED", `Cannot read file: ${error.message}`));
    return null;
  }
}

function checkInvestigation(root, filePath, investigationId, lines, output) {
  const declaredIdLines = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /^Local ID\s*:/i.test(line));
  const declaredId = declaredIdLines[0]?.line.match(/^Local ID\s*:\s*(.*?)\s*$/i)?.[1] ?? "";

  if (!localIdPattern.test(investigationId) || reservedNames.has(investigationId.toUpperCase())) {
    output.push(diagnostic(root, filePath, 1, "INVESTIGATION_ID_INVALID", `Directory name "${investigationId}" is not a safe investigation ID.`));
  }
  if (declaredIdLines.length !== 1 || declaredId !== investigationId) {
    output.push(diagnostic(root, filePath, declaredIdLines[0]?.number ?? 1, "INVESTIGATION_ID_MISMATCH", `Local ID must appear once and match directory ID "${investigationId}".`));
  }

  const formatLines = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /^Format version\s*:/i.test(line));
  if (formatLines.length !== 1 || !/^Format version\s*:\s*1\s*$/.test(formatLines[0]?.line ?? "")) {
    output.push(diagnostic(root, filePath, formatLines[0]?.number ?? 1, "INVESTIGATION_FORMAT_INVALID", "Expected exactly one `Format version: 1` field."));
  }

  for (const section of requiredInvestigationSections) {
    const found = lines.some((line) => line.trim().toLowerCase() === `## ${section}`.toLowerCase());
    if (!found) {
      output.push(diagnostic(root, filePath, 1, "INVESTIGATION_SECTION_MISSING", `Required section "## ${section}" is missing.`));
    }
  }
}

function parseRiskTable(root, filePath, lines, output) {
  const headerIndex = lines.findIndex((line) => hasHeader(tableCells(line), [
    "ID", "Step/State", "Risk", "Proposed oracle", "Observable", "Status",
  ]));
  if (headerIndex < 0) {
    output.push(diagnostic(root, filePath, 1, "RISK_TABLE_MISSING", "Expected the Stage 3 risk table with ID, step/state, risk, oracle, observability, and status columns."));
    return { riskIds: new Set(), tableEnd: lines.length };
  }

  const riskIds = new Set();
  let cursor = headerIndex + 1;
  if (isSeparator(tableCells(lines[cursor]))) cursor += 1;
  while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
    const cells = tableCells(lines[cursor]);
    if (!cells || isSeparator(cells)) {
      cursor += 1;
      continue;
    }
    const [id, step, risk, oracle, observable, status] = cells;
    const line = cursor + 1;
    if (cells.length < 6 || !id) {
      output.push(diagnostic(root, filePath, line, "RISK_ROW_MALFORMED", "Risk row needs an ID and all five required fields."));
      cursor += 1;
      continue;
    }
    if ([step, risk, oracle, observable].some((value) => !value)) {
      output.push(diagnostic(root, filePath, line, "RISK_FIELD_MISSING", `Risk ${id} has a blank step/state, risk, oracle, or observability field.`));
    }
    if (riskIds.has(id)) {
      output.push(diagnostic(root, filePath, line, "RISK_ID_DUPLICATE", `Risk ID ${id} appears more than once.`));
    }
    riskIds.add(id);
    if (!allowedRiskStatuses.has(status)) {
      output.push(diagnostic(root, filePath, line, "RISK_STATUS_INVALID", `Risk ${id} has status "${status}"; use PROPOSED, APPROVED, or REJECTED.`));
    }
    cursor += 1;
  }
  if (riskIds.size === 0) {
    output.push(diagnostic(root, filePath, headerIndex + 1, "RISK_TABLE_EMPTY", "Risk table has no data rows."));
  }
  return { riskIds, tableEnd: cursor };
}

function mappingSections(lines) {
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+Generated mapping\b/i.test(lines[index].trim())) {
      sections.push({ headingIndex: index, heading: lines[index].trim() });
    }
  }
  return sections;
}

function isCalendarDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysPerMonth[month - 1];
}

async function checkMappings(root, filePath, investigationId, lines, riskIds, output) {
  const sections = mappingSections(lines);
  if (sections.length === 0) return;

  const planPath = path.join(root, "specs", `${investigationId}.plan.md`);
  const planLines = await readLines(root, planPath, output);
  if (!planLines) {
    output.push(diagnostic(root, filePath, sections[0].headingIndex + 1, "MAPPING_PLAN_MISSING", `Generated mapping exists but specs/${investigationId}.plan.md is missing.`));
  }

  for (const [sectionIndex, section] of sections.entries()) {
    const nextSectionIndex = sections[sectionIndex + 1]?.headingIndex ?? lines.length;
    const headingDate = section.heading.match(/^##\s+Generated mapping\s+\((\d{4}-\d{2}-\d{2})\)$/i)?.[1];
    if (!headingDate || !isCalendarDate(headingDate)) {
      output.push(diagnostic(root, filePath, section.headingIndex + 1, "MAPPING_DATE_INVALID", "Generated mapping heading needs an ISO date: `## Generated mapping (YYYY-MM-DD)`."));
    }

    let headerIndex = -1;
    for (let index = section.headingIndex + 1; index < nextSectionIndex; index += 1) {
      if (hasHeader(tableCells(lines[index]), ["Risk ID", "TC ID", "File"])) {
        headerIndex = index;
        break;
      }
    }
    if (headerIndex < 0) {
      output.push(diagnostic(root, filePath, section.headingIndex + 1, "MAPPING_TABLE_MISSING", "Generated mapping section needs Risk ID, TC ID, and File columns."));
      continue;
    }

    let cursor = headerIndex + 1;
    if (isSeparator(tableCells(lines[cursor]))) cursor += 1;
    while (cursor < nextSectionIndex && lines[cursor].trim().startsWith("|")) {
      const cells = tableCells(lines[cursor]);
      if (!cells || isSeparator(cells)) {
        cursor += 1;
        continue;
      }
      const [riskId, tcId, testFile] = cells;
      const line = cursor + 1;
      if (!riskId || !tcId || !testFile) {
        output.push(diagnostic(root, filePath, line, "MAPPING_ROW_MALFORMED", "Mapping row requires a risk ID, TC ID, and test file."));
      }
      if (riskId && !riskIds.has(riskId)) {
        output.push(diagnostic(root, filePath, line, "MAPPING_RISK_UNKNOWN", `Mapping references unknown risk ${riskId}.`));
      }
      if (tcId && !/^TC-\d+$/i.test(tcId)) {
        output.push(diagnostic(root, filePath, line, "MAPPING_TC_INVALID", `Test case ID "${tcId}" must use TC-<number> format.`));
      } else if (tcId && planLines && !planLines.some((planLine) => new RegExp(`^#{1,6}\\s+.*\\b${tcId}\\s*:`, "i").test(planLine))) {
        output.push(diagnostic(root, filePath, line, "MAPPING_TC_MISSING", `Plan specs/${investigationId}.plan.md has no entry for ${tcId}.`));
      }
      cursor += 1;
    }
  }
}

async function readArtifactDirectoryEntries(root, artifactRoot, output) {
  try {
    return await readdir(artifactRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    output.push(diagnostic(root, artifactRoot, 1, "ARTIFACT_DIRECTORY_UNREADABLE", `Cannot inspect qa-artifacts/: ${error.message}`));
    return [];
  }
}

/** Read-only structural check for intake and risk artifacts under qa-artifacts/. */
export async function checkArtifacts(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const artifactRoot = path.join(root, "qa-artifacts");
  const diagnostics = [];
  try {
    const rootMetadata = await stat(root);
    if (!rootMetadata.isDirectory()) {
      diagnostics.push(diagnostic(root, root, 1, "CHECK_ROOT_INVALID", "The checker root must be a directory."));
      return { diagnostics, summary: "Cannot check QA artifacts: root is not a directory." };
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      diagnostics.push(diagnostic(root, root, 1, "CHECK_ROOT_MISSING", "The checker root does not exist; verify the `--root` path."));
      return { diagnostics, summary: "Cannot check QA artifacts: root does not exist." };
    }
    diagnostics.push(diagnostic(root, root, 1, "CHECK_ROOT_UNREADABLE", `Cannot inspect checker root: ${error.message}`));
    return { diagnostics, summary: "Cannot check QA artifacts: root is unreadable." };
  }
  const directories = await readArtifactDirectoryEntries(root, artifactRoot, diagnostics);
  const investigationIds = directories.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const foldedIds = new Map();
  for (const id of investigationIds) {
    const prior = foldedIds.get(id.toLowerCase());
    if (prior && prior !== id) {
      diagnostics.push(diagnostic(root, artifactRoot, 1, "INVESTIGATION_ID_COLLISION", `Directories "${prior}" and "${id}" collide on case-insensitive filesystems.`));
    }
    foldedIds.set(id.toLowerCase(), id);
  }

  let checkedFiles = 0;
  for (const id of investigationIds) {
    const directory = path.join(artifactRoot, id);
    const investigationPath = path.join(directory, "investigation.md");
    const investigationLines = await readLines(root, investigationPath, diagnostics);
    if (investigationLines) {
      checkedFiles += 1;
      checkInvestigation(root, investigationPath, id, investigationLines, diagnostics);
    }

    const risksPath = path.join(directory, "risks.md");
    const risksLines = await readLines(root, risksPath, diagnostics);
    if (risksLines) {
      checkedFiles += 1;
      const { riskIds } = parseRiskTable(root, risksPath, risksLines, diagnostics);
      await checkMappings(root, risksPath, id, risksLines, riskIds, diagnostics);
    }
  }

  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.code.localeCompare(right.code));
  const summary = checkedFiles === 0
    ? "No QA artifacts found; nothing to check."
    : `Checked ${checkedFiles} QA artifact file${checkedFiles === 1 ? "" : "s"}; ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"}.`;
  return { diagnostics, summary };
}

function printUsage() {
  process.stdout.write("Usage: node qa-harness/checks/qa-check.mjs [--root <repo-root>]\n");
}

async function main(args) {
  let root = process.cwd();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--help" || args[index] === "-h") {
      printUsage();
      return 0;
    }
    if (args[index] === "--root" && args[index + 1]) {
      root = args[index + 1];
      index += 1;
      continue;
    }
    process.stderr.write(`Unknown or incomplete argument: ${args[index]}\n`);
    printUsage();
    return 2;
  }

  const result = await checkArtifacts(root);
  for (const item of result.diagnostics) {
    process.stdout.write(`${item.path}:${item.line} [${item.code}] ${item.message}\n`);
  }
  process.stdout.write(`${result.summary}\n`);
  return result.diagnostics.length === 0 ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
