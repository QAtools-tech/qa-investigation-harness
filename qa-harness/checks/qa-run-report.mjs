import { randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCoverage } from "./coverage-report.mjs";
import { parsePlaywrightReport, PlaywrightReportError } from "./playwright-json.mjs";
import { renderRunReport } from "./run-report-render.mjs";
import { buildTraceabilityMatrix, renderTraceabilityMatrix } from "./traceability-matrix.mjs";

const valueFlags = ["--report", "--root", "--investigation", "--run-id", "--target", "--revision", "--captured-at", "--json-out", "--markdown-out"];
const requiredFlags = ["--report", "--root", "--investigation", "--run-id", "--target", "--json-out", "--markdown-out"];

class UsageError extends Error {}
class InputError extends Error {}

function usage() {
  return "Usage: node qa-harness/checks/qa-run-report.mjs --report <file> --root <project> --investigation <id> --run-id <id> --target <name> --json-out <file> --markdown-out <file> [--revision <rev>] [--captured-at <ISO-time>] [--force]\n       node qa-harness/checks/qa-run-report.mjs matrix --root <project> --investigation <id> [--report <file> --run-id <id> --target <name> [--revision <rev>]] [--markdown-out <file> --csv-out <file>] [--force]";
}

export function parseArgs(argv) {
  const values = new Map();
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--force") {
      if (force) throw new UsageError("Duplicate flag --force.");
      force = true;
      continue;
    }
    if (!valueFlags.includes(flag)) throw new UsageError(`Unknown option ${flag}.`);
    if (values.has(flag)) throw new UsageError(`Duplicate option ${flag}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value for ${flag}.`);
    values.set(flag, value);
    index += 1;
  }
  const missing = requiredFlags.filter((flag) => !values.has(flag));
  if (missing.length) throw new UsageError(`Missing required ${missing.join(", ")}.`);
  if (values.get("--run-id").trim() === "") throw new UsageError("--run-id cannot be empty.");
  if (values.get("--target").trim() === "") throw new UsageError("--target cannot be empty.");
  if (values.has("--captured-at") && !Number.isFinite(Date.parse(values.get("--captured-at")))) {
    throw new UsageError("--captured-at must be a valid date/time.");
  }
  return { values, force };
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolveOutputs(projectRoot, rootReal, jsonPath, markdownPath) {
  const resolved = [path.resolve(jsonPath), path.resolve(markdownPath)];
  const canonical = [];
  for (const outputPath of resolved) {
    if (!isInside(projectRoot, outputPath)) throw new UsageError("Output paths must be inside the selected project root.");
    const parent = path.dirname(outputPath);
    let parentReal;
    try {
      parentReal = await realpath(parent);
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Output directory does not exist: ${parent}`);
      throw error;
    }
    if (!isInside(rootReal, parentReal)) throw new UsageError("Output directory resolves outside the selected project root.");
    canonical.push(path.join(parentReal, path.basename(outputPath)));
  }
  const comparison = canonical.map((item) => process.platform === "win32" ? item.toLowerCase() : item);
  if (comparison[0] === comparison[1]) throw new UsageError("JSON and Markdown outputs must resolve to different files.");
  return canonical;
}

async function outputState(outputPath, force) {
  try {
    const info = await lstat(outputPath);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Output path is not a regular file: ${outputPath}`);
    if (!force) throw new Error(`Output already exists; pass --force to replace it: ${outputPath}`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function cleanup(paths) {
  await Promise.all(paths.map((item) => unlink(item).catch(() => {})));
}

async function writeOutputPair(jsonPath, markdownPath, jsonText, markdownText, force) {
  const targets = [jsonPath, markdownPath];
  const existed = [];
  for (const target of targets) existed.push(await outputState(target, force));

  const temporary = targets.map((target) => path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`));
  const backups = targets.map((target) => path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.bak`));
  const movedBackups = [];
  const installed = [];
  try {
    await writeFile(temporary[0], jsonText, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await writeFile(temporary[1], markdownText, { encoding: "utf8", flag: "wx", mode: 0o600 });
    for (let index = 0; index < targets.length; index += 1) {
      if (existed[index]) {
        await rename(targets[index], backups[index]);
        movedBackups.push(index);
      }
    }
    for (let index = 0; index < targets.length; index += 1) {
      await rename(temporary[index], targets[index]);
      installed.push(index);
    }
    await cleanup(movedBackups.map((index) => backups[index]));
  } catch (error) {
    await cleanup(installed.map((index) => targets[index]));
    for (const index of movedBackups.reverse()) {
      await rename(backups[index], targets[index]).catch(() => {});
    }
    await cleanup(temporary);
    throw error;
  }
}

async function loadRun(reportPath, source) {
  let content;
  try {
    content = await readFile(reportPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new InputError(`Playwright report is missing or is not a file: ${reportPath}`);
    throw error;
  }
  let report;
  try {
    report = JSON.parse(content);
  } catch {
    throw new InputError("Playwright report is not valid JSON.");
  }
  try {
    return parsePlaywrightReport(report, { source });
  } catch (error) {
    if (error instanceof PlaywrightReportError) throw new InputError(error.message);
    throw error;
  }
}

async function matrixMain(argv) {
  const allowed = new Set(["--root", "--investigation", "--markdown-out", "--csv-out", "--report", "--run-id", "--target", "--revision"]);
  const values = new Map(); let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--force") { if (force) throw new UsageError("Duplicate flag --force."); force = true; continue; }
    if (!allowed.has(key) || values.has(key) || !argv[i + 1] || argv[i + 1].startsWith("--")) throw new UsageError(`Invalid or duplicate matrix option ${key}.`);
    values.set(key, argv[++i]);
  }
  for (const key of ["--root", "--investigation"]) if (!values.has(key)) throw new UsageError(`Missing required ${key}.`);
  if (values.has("--markdown-out") !== values.has("--csv-out")) throw new UsageError("--markdown-out and --csv-out must be supplied together.");
  const runKeys = ["--run-id", "--target", "--revision"].filter((key) => values.has(key));
  if (values.has("--report") ? !values.has("--run-id") || !values.has("--target") : runKeys.length > 0) throw new UsageError("With --report, --run-id and --target are required; without --report, run metadata is not allowed.");
  const root = path.resolve(values.get("--root"));
  const rootReal = await realpath(root);
  const outputs = values.has("--csv-out") ? await resolveOutputs(root, rootReal, values.get("--csv-out"), values.get("--markdown-out")) : null;
  let run = null; let reportReal = null;
  if (values.has("--report")) {
    const report = path.resolve(values.get("--report"));
    reportReal = await realpath(report).catch((error) => error.code === "ENOENT" ? report : Promise.reject(error));
    if (outputs?.some((output) => path.resolve(output) === path.resolve(reportReal))) throw new InputError("Matrix outputs must not replace the input Playwright report.");
    run = await loadRun(report, path.relative(root, report).split(path.sep).join("/") || path.basename(report));
    run.metadata.runId = values.get("--run-id"); run.metadata.target = values.get("--target"); run.metadata.revision = values.get("--revision") ?? null;
  }
  const coverage = await buildCoverage(root, values.get("--investigation"), run, { includeMatrixEvidence: true });
  const rendered = renderTraceabilityMatrix(buildTraceabilityMatrix(coverage, { selectedRun: run?.metadata ?? null }));
  if (outputs) {
    await writeOutputPair(outputs[0], outputs[1], rendered.csv, rendered.markdown, force);
    process.stdout.write("Wrote CSV and Markdown traceability matrix.\n");
  } else process.stdout.write(rendered.markdown);
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "matrix") {
    try { return await matrixMain(argv.slice(1)); }
    catch (error) {
      process.stderr.write(`${error.message}\n`);
      return error instanceof UsageError || error instanceof InputError || error.message.includes("Invalid investigation ID") || error.message.includes("escapes") ? 2 : 3;
    }
  }
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`);
    return 2;
  }
  const values = args.values;
  const projectRoot = path.resolve(values.get("--root"));
  let rootReal;
  try {
    rootReal = await realpath(projectRoot);
    if (!(await stat(rootReal)).isDirectory()) throw new InputError("--root must name a project directory.");
  } catch (error) {
    const message = error instanceof InputError ? error.message : error.code === "ENOENT" ? "Project root does not exist." : error.message;
    process.stderr.write(`${message}\n`);
    return error instanceof InputError || error.code === "ENOENT" ? 2 : 3;
  }

  let outputPaths;
  try {
    outputPaths = await resolveOutputs(projectRoot, rootReal, values.get("--json-out"), values.get("--markdown-out"));
  } catch (error) {
    const code = error instanceof UsageError ? 2 : 3;
    process.stderr.write(`${error.message}\n`);
    return code;
  }

  const reportPath = path.resolve(values.get("--report"));
  let run;
  let coverage;
  try {
    const sourcePath = await realpath(reportPath).catch((error) => {
      if (error.code === "ENOENT") return reportPath;
      throw error;
    });
    if (outputPaths.some((output) => path.relative(sourcePath, output) === "")) {
      throw new InputError("Report outputs must not replace the input Playwright report.");
    }
    run = await loadRun(reportPath, path.relative(projectRoot, reportPath).split(path.sep).join("/") || path.basename(reportPath));
    coverage = await buildCoverage(projectRoot, values.get("--investigation"), run);
  } catch (error) {
    if (error instanceof InputError || error.message.startsWith("Invalid investigation ID") || error.message.includes("escapes")) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    process.stderr.write(`Cannot read selected evidence: ${error.message}\n`);
    return 3;
  }

  run.metadata.runId = values.get("--run-id");
  run.metadata.target = values.get("--target");
  run.metadata.revision = values.get("--revision") ?? null;
  run.metadata.capturedAt = values.get("--captured-at") ?? null;
  const rendered = renderRunReport(run, coverage);
  try {
    await writeOutputPair(outputPaths[0], outputPaths[1], `${JSON.stringify(rendered.json, null, 2)}\n`, rendered.markdown, args.force);
  } catch (error) {
    process.stderr.write(`Cannot write report outputs: ${error.message}\n`);
    return 3;
  }
  process.stdout.write(`Wrote JSON and Markdown run reports.\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`Operational error: ${error.message}\n`);
    process.exitCode = 3;
  });
}
