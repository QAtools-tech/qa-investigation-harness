# Playwright Run Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare two saved schema-version-2 harness run reports for the same investigation and exact target, and write a reviewable JSON/Markdown comparison.

**Architecture:** Add a pure comparison module that validates report data, joins stored execution links to their `tests[]` records, and classifies case/project outcomes. Add a `compare` subcommand to the existing CLI that reads both saved reports and reuses the current safe paired-output path and writer. Update the CLI guidance and project capability docs.

**Tech Stack:** Node.js ES modules and built-in `node:test`; no new dependency and no Playwright execution.

**Spec:** [2026-11-12-playwright-run-comparison-design.md](../specs/2026-11-12-playwright-run-comparison-design.md)

## Global Constraints

- Compare saved harness reports only; accept schema version 2.
- Require exact equality of stored investigation IDs and target strings.
- Align by stored case ID and Playwright project name; never infer matches from titles or current files.
- The current normalized run status set is `expected`, `failure`, `skipped`, `flaky`, and `unknown`.
- Missing, unmapped, project-not-included, or ambiguous evidence is `not comparable`; never infer additions, removals, or root cause.
- Keep source reports and investigation artifacts read-only; write only the requested comparison outputs inside the project root.
- Add no dependency and no Playwright test code; do not perform a live browser run.

## Review Focus

- Unsupported schema version or malformed consumed fields must fail with a useful input error and no output files. Test in Task 1 and Task 2.
- Optional run provenance fields must be absent, null, or strings; unnamed projects from the current report producer must be preserved as ambiguous. Test model validation and producer-to-comparison CLI behavior.
- Different investigation IDs or target strings, including whitespace-only differences, must be rejected. Test exact comparisons in Task 1 and CLI mismatch behavior in Task 2.
- Duplicate/conflicting mappings, non-unique pointer joins, and a `test-run.runStatus` disagreement with the joined `tests[]` status must be ambiguous, not silently selected. Test in Task 1.
- A mapped case with no result, a case mapped in one report only, or a project absent from one run must remain `not comparable`, with each side's evidence state and reason visible in Markdown. Test in Task 1 and Task 2.
- Output paths that escape the root directly or through a symlink, collide with inputs, or collide with each other must be rejected without replacing evidence. Test in Task 2.

---

### Task 1: Build the saved-report comparison model

**Files:**
- Create: `qa-harness/checks/run-comparison.mjs`
- Test: `qa-harness/checks/run-comparison.test.mjs`

**Interfaces:**
- Produces: `buildRunComparison(beforeReport, afterReport)` returning `{ schemaVersion, investigationId, before, after, counts, rows }` or throwing `RunComparisonInputError` for invalid/incompatible inputs.
- Each row contains `caseId`, `projectName`, `before`, `after`, `classification`, and an optional evidence reason. Each side contains `evidence`, `status`, `sourcePointer`, and `mappedFile` when available.

- [x] **Step 1: Write failing tests for accepted inputs and exact identity checks**

Test that two schema-v2 reports with the same stored investigation ID and target produce a comparison, and that either a target mismatch or investigation mismatch throws `RunComparisonInputError`. Include a target differing only by surrounding whitespace.

- [x] **Step 2: Run the focused tests and confirm the expected failures**

Run: `node --test qa-harness/checks/run-comparison.test.mjs`
Expected: FAIL because the comparison module and exported API do not exist.

- [x] **Step 3: Implement report validation and comparison entry point**

Implement `RunComparisonInputError` and `buildRunComparison(beforeReport, afterReport)` in `qa-harness/checks/run-comparison.mjs`. Validate schema version 2, non-empty investigation ID/run ID/target, the consumed report sections, project-name arrays, and the consumed link/test fields. Compare the investigation IDs and target strings exactly. Keep the implementation pure: it reads no files and consults no current investigation artifacts.

- [x] **Step 4: Add failing tests for evidence joining and classifications**

Cover the `expected` → `failure` and `expected` → `flaky` regressions, `failure`/`flaky` → `expected` recovery, same-status `unchanged`, other status changes, and `unknown`. Cover `no-result`, `unmapped`, `project-not-included`, duplicate-identical links, conflicting mappings, multiple distinct test-run links, non-unique source-pointer joins, status disagreement, malformed optional provenance fields, and empty/null project names. Assert that case/project rows are made from the union of case IDs and the union of project names; an unnamed project result keeps its status and locator but is ambiguous. Missing evidence is `not comparable` and never called added, removed, passed, or failed.

- [x] **Step 5: Run the focused tests and confirm the expected failures**

Run: `node --test qa-harness/checks/run-comparison.test.mjs`
Expected: FAIL only for the comparison behaviors not yet implemented.

- [x] **Step 6: Implement evidence matching and classification**

Use each report's `coverage.links`: `plan-test.fromId` provides the case mapping; `test-run.fromId` identifies the case execution; join `test-run.toId` and `targetLocator` to exactly one `tests[].sourcePointer` to obtain project name and normalized status. Require link and test statuses to agree. Deduplicate identical links only; mark distinct mappings/results or non-unique joins ambiguous. Candidate rows are the Cartesian product of the union of case IDs and union of project names. For each report, assign evidence in this order: `project-not-included`, `unmapped`, `ambiguous`, `observed`, then `no-result`. Classify only two observed statuses: equal as `unchanged`; `expected` to `failure`/`flaky` as `regressed`; `failure`/`flaky` to `expected` as `recovered`; all other transitions as `changed`. All other evidence pairs are `not comparable`.

- [x] **Step 7: Run focused comparison tests and confirm they pass**

Run: `node --test qa-harness/checks/run-comparison.test.mjs`
Expected: all focused tests pass.

---

### Task 2: Add the `compare` CLI command and safe outputs

**Files:**
- Modify: `qa-harness/checks/qa-run-report.mjs`
- Modify: `qa-harness/checks/run-report-render.mjs`
- Test: `qa-harness/checks/qa-run-report.test.mjs`

**Interfaces:**
- Consumes: `buildRunComparison(beforeReport, afterReport)` from Task 1 and the existing `resolveOutputs`, `writeOutputPair`, and `--force` behavior.
- Consumes: exported `markdownText(value)` from `run-report-render.mjs` for escaping comparison values.
- Produces: `node qa-harness/checks/qa-run-report.mjs compare --root <project> --before <baseline-json> --after <later-json> --json-out <file> --markdown-out <file> [--force]`.

- [x] **Step 1: Write failing CLI tests for compare usage, same-target checks, and output safety**

Use temporary project roots and saved report fixtures. Assert successful output for matching target/investigation, rejection of target and investigation mismatch, malformed or unsupported input/provenance with no outputs, both evidence states and reasons in Markdown, outputs staying under root, distinct JSON/Markdown paths, protection of both inputs, preservation unless `--force`, producer-to-comparison behavior for an unnamed project, and the nested-output case where a run report's available attachment link resolves relative to Markdown in a nested directory.

- [x] **Step 2: Run the focused CLI tests and confirm the expected failures**

Run: `node --test qa-harness/checks/qa-run-report.test.mjs`
Expected: the new `compare` invocation fails because the subcommand is not implemented; existing report CLI tests remain unchanged.

- [x] **Step 3: Implement compare argument parsing and report loading**

Export the existing `markdownText(value)` helper from `run-report-render.mjs`. Add `compareMain(argv)` with explicit allowed/required options, `--force`, project-root validation, and two report reads. Validate output paths through `resolveOutputs`; resolve both input paths canonically and refuse either output if it would replace either input. Pass parsed JSON objects to `buildRunComparison` and map `RunComparisonInputError` to the CLI's existing input-error exit code.

- [x] **Step 4: Render the comparison JSON and Markdown pair**

Write a JSON object with comparison schema version `1`, generation timestamp, same investigation ID, both reports' run metadata, classification counts, and rows. Render Markdown with the before/after metadata, counts, per-case/project evidence states and statuses, classification, and source pointers. Escape untrusted Markdown values using the existing `markdownText` conventions, and write both files with the existing transactional `writeOutputPair` helper.

- [x] **Step 5: Run the focused CLI tests and confirm they pass**

Run: `node --test qa-harness/checks/qa-run-report.test.mjs`
Expected: all CLI tests pass, including the nested attachment-link case.

---

### Task 3: Document run comparison and verify the full checker suite

**Files:**
- Modify: `qa-harness/checks/README.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Documents the `compare` CLI, its same-investigation/same-target requirement, output paths, classifications, and evidence limitations.

- [x] **Step 1: Update the checks README with command and comparison semantics**

Add the exact CLI usage, explain that it compares two saved schema-v2 harness reports, describe classifications and not-comparable evidence, and state that runner outcomes do not prove oracle conformance or cause.

- [x] **Step 2: Update README and architecture routes**

Describe offline comparison as an option after saved reports exist. State that it requires the same investigation and exact target and leaves Playwright execution and cause inference outside the harness.

- [x] **Step 3: Run the full Node checks suite and artifact checker**

Run: `node --test qa-harness/checks/*.test.mjs`
Expected: all checks tests pass.

Run: `node qa-harness/checks/qa-check.mjs`
Expected: reports no structural artifact errors for the repository fixtures.
