# QA Traceability Matrix Implementation Plan

**Goal:** Show which requirements have approved coverage, which cases have mapped tests, and what one selected Playwright run and Stage 5 review establish.

**Architecture:** Extend the existing offline report command with a `matrix` mode. Reuse the coverage builder and its evidence readers. Generate Markdown and CSV from one projection of those records.

**Tech stack:** Node.js built-ins and the existing Markdown investigation artifacts.

## Scope and behavior

- One investigation and zero or one selected Playwright JSON report. A pre-run matrix is a normal result.
- Keep the current report command and artifact formats compatible. The matrix does not store new decisions, run Playwright, or change a test, plan, or source artifact.
- List requirement, risk and decision, plan case, mapped test path, mapping status, execution, validation, and source locators. Show requirements with no risk, risks without a current approval, and approved risks without a mapped test. Keep risks with no requirement reference visible.
- Keep mapping, approval freshness, execution, and validation separate. A mapped file can be missing, a selected run can have no matching result, and a successful run can still have a weak assertion. Keep stale or ambiguous evidence visible without guessing a link.
- Use existing IDs within the selected investigation. Show the selected run ID, target, and optional revision. Keep individual project outcomes visible when a case ran in multiple Playwright projects.

## Task 1: Project existing coverage into matrix rows

**Files:** `qa-harness/checks/coverage-report.mjs`, new `qa-harness/checks/traceability-matrix.mjs`.

- [x] Add opt-in matrix evidence to `buildCoverage(rootDirectory, investigationId, run, { includeMatrixEvidence: true })`. Return parsed requirements, risks, decisions, mappings, and validation findings with existing locators. Keep the current return shape for existing callers. Accept `null` as the explicit no-run input and skip execution reconciliation in that case.
- [x] Implement `buildTraceabilityMatrix(coverage, { investigationId, selectedRun })`, returning `{ investigationId, selectedRun, rows }`. Join through the existing coverage links. Do not treat a stale or conflicting decision as current coverage. Emit one row per requirement, risk, and mapped case combination. Include partial rows for missing links. Keep execution results as a per-project list inside each row.
- [x] Sort rows by requirement, risk, and case ID with file path as the final tie breaker. Use the same order for both exports.

## Task 2: Export and expose the matrix in chat

**Files:** `qa-harness/checks/traceability-matrix.mjs`, `qa-harness/checks/qa-run-report.mjs`, `qa-harness/GUIDED-CHAT.md`, `qa-harness/checks/README.md`.

- [x] Add `renderTraceabilityMatrix(matrix)` returning `{ markdown, csv }`. Escape Markdown table cells. Quote CSV fields and protect spreadsheet formula prefixes in imported text. Include the same columns and source locators in both outputs.
- [x] Add `node qa-harness/checks/qa-run-report.mjs matrix --root <project> --investigation <id> --markdown-out <file> --csv-out <file>`. Accept `--report`, `--run-id`, `--target`, and optional `--revision` together as run inputs. Without `--report`, reject run metadata and label execution `no run selected`. With `--report`, require run ID and target. Preserve existing report invocation and overwrite protections, including the input-report alias guard.
- [x] Route “Show the traceability matrix for <investigation-id>” to saved evidence in the shared chat guide. Present the matrix in chat by default. Write export files only when requested. Document a pre-run example and a selected-run example.

## Verification (requested 2026-11-12)

- Focused checks: 29/29 pass (`coverage-report`, `qa-run-report`, and `traceability-matrix`).
- Full suite: 68/68 pass (`node --test qa-harness/checks/*.test.mjs`).
- Covered: pre-run matrix visibility, per-project selected-run outcomes, Markdown/CSV rendering and formula prefixing, CLI stdout and selected-run export, and refusal to replace the report input.
- Existing coverage checks cover unresolved file mappings and stale/unknown decision freshness. Remaining matrix-specific cases include no-risk/no-mapping rows, weak validation alongside passing execution, and distinct ambiguous-evidence cells.

**Dependency:** Build on the existing staged audit fixes for decision freshness, case-and-file matching, and validation table compatibility. Keep the unrelated Jira changes separate.
