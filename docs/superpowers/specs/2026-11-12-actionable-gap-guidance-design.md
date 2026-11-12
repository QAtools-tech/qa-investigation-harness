# Actionable Gap Guidance Design

## Intent

Help QA users decide what to do when the traceability matrix or saved-run comparison exposes an evidence gap. The repository already reports gap categories, source locations, and reasons; this change adds a concise next step that uses those existing facts.

## Goals

- Add a Next action field to traceability-matrix rows and exports.
- Give non-comparable saved-run comparison rows a concrete next step.
- Keep each recommendation tied to the visible evidence state and source locator.
- Preserve the current gap detection and comparison classifications.

## Non-goals and anti-goals

- Do not add scores, priorities, automatic repairs, approvals, or inferred mappings.
- Do not edit investigation artifacts, test plans, generated tests, or reports being compared.
- Do not invoke Playwright or a project test generator.
- Do not change how a gap is detected or whether a run is comparable.

## Constraints

- Use only current matrix/comparison data and existing reason fields.
- Never present a missing result as a test failure or a passing result as oracle conformance.
- Human decisions remain human-owned; generated test code remains owned by the consuming project.
- Keep Markdown, CSV, JSON, and CLI output consistent with their existing schemas and conventions.

## Approaches

1. Matrix only. Add next steps to matrix rows, leaving saved-run comparisons with evidence and reasons only. Smallest change, but leaves non-comparable comparisons without a next step.
2. Matrix and comparison guidance — selected. Derive concise next steps from existing matrix states and comparison evidence states. This closes guidance across requirement, risk, approval, plan, test, validation, and run evidence without changing detection.
3. Prioritized gap dashboard. Rank or score gaps and add a separate dashboard. Rejected because the request asks for explanations and actions, not a new scoring model.

## Proposed behavior

Add one Next action to each matrix row when an unresolved step exists. Prefer the earliest blocking prerequisite: missing or unlinked requirement/risk evidence; missing, stale, unknown, or ambiguous human decision; missing or unresolved plan/test mapping; missing run result; then missing validation or a recorded validation finding. A fresh rejected decision does not trigger test-generation guidance. Give a concrete action and retain the row's source locators. Rows with no actionable gap may leave the field empty. The current matrix does not encode a terminal conforming-validation state, so do not infer one from an empty findings list.

For a comparison row classified not comparable, show a next step based on its before/after evidence states: add a result for no-result; produce fresh reports with explicit mappings for unmapped; include the project in both runs for project-not-included; and resolve conflicting evidence before comparing ambiguous. Keep the existing per-side states and reasons visible. Do not recommend interpreting one-sided evidence as a regression or recovery.

Recommendations are guidance only. They do not write files or choose risk decisions. The matrix's Markdown and CSV exports and the comparison's Markdown output must show the same recommendation represented by their underlying result data. Add the comparison row field as an output-schema change and bump comparison JSON schema from 1 to 2; run-report input schema remains 2.

## Builder decisions

The builder may choose the smallest helper and rendering changes consistent with existing modules. Preserve existing output fields and path safety. Add tests for each guidance category and for rows that need no recommendation.
