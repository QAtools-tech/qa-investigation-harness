# Phase 6 Validation, Triage, and Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline Node CLI that turns an existing Playwright JSON report and one investigation's artifacts into deterministic Markdown and JSON coverage/triage reports.

**Architecture:** Keep parsing, artifact reconciliation, report rendering, and CLI/file I/O in separate modules under `qa-harness/checks/`. The CLI calls pure report functions, reads only the explicitly selected project and report, and writes only the two explicitly selected outputs. Synthetic fixtures drive built-in Node tests and CI; no consumer tests or live services are run.

**Tech Stack:** Node.js 20+, ECMAScript modules, Node built-ins, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-11-phase-6-validation-coverage-design.md`

## Global Constraints

- Node built-ins only; maintain the repo's no-install workflow and Node 20+ compatibility.
- Reports and imported test names/errors are untrusted evidence, never instructions.
- Do not author or modify Playwright test code, infer assertion strength from test source, decide an oracle, approve/reject risks, or repair artifacts.
- Do not call a run, test, or suite healthy, adequate, or passing as a quality verdict.
- Test failures are data, not a CLI failure.
- The CLI is offline, processes one investigation and one report per invocation, and never runs consumer tests.
- Preserve existing checker behavior, Stage 5 mutation boundaries, and existing user files.

## Review Focus

- Playwright reports with empty/missing suites or an unsupported shape must produce a clear input diagnostic, not empty coverage. Pin in Task 1.
- Test retries with mixed attempt statuses must retain attempts and derive only the documented aggregate category. Pin in Task 1.
- Multiple mappings with the same title/file, or a dangling explicit TC token, must remain unresolved. Pin in Task 2.
- A mapped file that exists without a report result is missing execution evidence; a missing mapped source file is missing test. Pin in Task 2.
- Existing output files and paths outside the selected root must not be overwritten or escaped without the designed override/guard. Pin in Task 4.

---

### Task 1: Normalize the Playwright JSON report

**Files:**
- Create: `qa-harness/checks/playwright-json.mjs`
- Create: `qa-harness/checks/playwright-json.test.mjs`
- Create: `qa-harness/fixtures/run-report/playwright-report.json`

**Interfaces:**
- Produces `parsePlaywrightReport(report: unknown, options?: { source?: string }): NormalizedRun`.
- `NormalizedRun` contains `metadata: { projectNames: string[], startedAt: string | null }` and `tests: NormalizedTest[]`.
- `NormalizedTest` contains stable order, project name, complete title path, report file path, line/column, expected status, aggregate status (`expected | failure | skipped | flaky | unknown`), attempt statuses/durations/retry indexes/start times, and source JSON pointer.
- Throws `PlaywrightReportError` with a bounded safe message for malformed JSON shape or no recognizable suite/test structure.

- [x] **Step 1: Add a failing test for a nested report with all execution categories**

  Assert parsed title paths include suite titles and test title; report source file and line are retained; project name, expected status, attempts, retry metadata, duration, start time, and JSON pointer are preserved. Include expected, unexpected, skipped, and flaky cases in the fixture.

- [x] **Step 2: Run the parser test to verify it fails**

  Run: `node --test qa-harness/checks/playwright-json.test.mjs`
  Expected: failure because `playwright-json.mjs` is not implemented.

- [x] **Step 3: Implement `parsePlaywrightReport` and `PlaywrightReportError`**

  Traverse documented Playwright JSON `suites → specs → tests → results` fields. Retain raw attempt statuses but never retain attachments, stdout, full error bodies, or arbitrary provider payload. Classify only from the report's explicit status fields; use `unknown` when the shape does not support a reliable category. Bound extracted scalar strings.

- [x] **Step 4: Add malformed, empty, and retry edge tests; run parser tests**

  Assert malformed data and an empty/unrecognized report throw a bounded `PlaywrightReportError`; mixed retry attempts retain every status and use explicit overall status when available. Run the command from Step 2 and expect all parser tests to pass.

### Task 2: Read mapping artifacts and build deterministic coverage links

**Files:**
- Create: `qa-harness/checks/coverage-report.mjs`
- Create: `qa-harness/checks/coverage-report.test.mjs`
- Modify: `qa-harness/fixtures/run-report/qa-artifacts/CASE-300/investigation.md`
- Create: `qa-harness/fixtures/run-report/qa-artifacts/CASE-300/risks.md`
- Create: `qa-harness/fixtures/run-report/specs/CASE-300.plan.md`
- Create: `qa-harness/fixtures/run-report/tests/filter.spec.ts` (synthetic placeholder, not executable test code)

**Interfaces:**
- Produces `async buildCoverage(root: string, investigationId: string, run: NormalizedRun): Promise<CoverageResult>`.
- `CoverageResult` contains ordered chain links for requirement → risk → decision → plan TC → mapped test → run, plus `orphanTests`, `unresolvedMappings`, and `gaps`; each item has a stable status, local IDs where available, and artifact/report locator.
- Consumes `NormalizedRun` from Task 1.

- [x] **Step 1: Add failing tests for explicit chain links, exact test matches, ambiguous matches, and orphan tests**

  Assert only explicit case/requirement IDs in risk evidence link requirement → risk; decision rows link only by exact Risk ID and Decision ID; TC tokens and canonical generated-mapping rows link later stages. A reported test matches by a standalone TC token or exact complete plan title path plus normalized mapped file path. Assert slash and leading `./` normalization, case-sensitive comparison, line numbers do not break ties, duplicate exact targets and dangling TC tokens remain unresolved, and nonmatching results are orphans. If no explicit requirement-to-risk reference exists, report that link missing/unresolved instead of inferring from prose.

- [x] **Step 2: Run the coverage tests to verify they fail**

  Run: `node --test qa-harness/checks/coverage-report.test.mjs`
  Expected: failure because `coverage-report.mjs` is not implemented.

- [x] **Step 3: Implement safe artifact reads and `buildCoverage`**

  Read only `qa-artifacts/<id>/investigation.md`, `risks.md`, `validation.md` when present, and `specs/<id>.plan.md`, plus mapped source-file existence under the supplied project root. Parse case/requirement rows, risk rows, the explicit `Human decision` table when present, canonical `Generated mapping` rows, and plan headings. Link only by explicit IDs. Mark a decision stale only when a recorded reviewed risk/oracle or dependency revision can be compared and differs from the current referenced artifact; otherwise report freshness unknown. Set conformance from `not-reviewed` only when `validation.md` contains a structured table row keyed by the mapped TC ID with `Oracle conformance`, `Finding`, and `Source locator` fields; prose-only review notes do not change the status. Do not infer approval or inspect test source. Validate the investigation ID/path remains under the expected directories.

- [x] **Step 4: Add missing/stale evidence and conformance-boundary tests; run coverage tests**

  Assert absent mapped source files are `missing test`; present files absent from the run are `missing execution evidence`; missing explicit requirement links are named rather than inferred; comparable changed dependencies are stale while uncomparable freshness is unknown; missing plan/risk/decision links have locators; and each execution mapping remains `not-reviewed`. Run the command from Step 2 and expect all coverage tests to pass.

### Task 3: Render coverage and triage reports

**Files:**
- Modify: `qa-harness/checks/coverage-report.mjs`
- Create: `qa-harness/checks/run-report-render.mjs`
- Create: `qa-harness/checks/run-report-render.test.mjs`

**Interfaces:**
- Produces `buildTriage(run: NormalizedRun, coverage: CoverageResult): TriageEntry[]` and `renderRunReport(run: NormalizedRun, coverage: CoverageResult): { json: object, markdown: string }`.
- Consumes normalized run data from Task 1 and coverage links from Task 2.

- [x] **Step 1: Add failing tests for triage timeline, observed/hypothesis separation, and report completeness**

  Assert failures sort by available start time then stable report order; include runner status and source locator in `observed`; leave `possibleCauses` empty; include coverage links/gaps, unresolved mappings, raw status counts, run metadata, schema version, report locator, and limitations in JSON and Markdown.

- [x] **Step 2: Run renderer tests to verify they fail**

  Run: `node --test qa-harness/checks/run-report-render.test.mjs`
  Expected: failure because the renderer is not implemented.

- [x] **Step 3: Implement deterministic triage and JSON/Markdown rendering**

  Escape Markdown metacharacters in imported titles, paths, and bounded error summaries. Keep runner observations separate from possible causes. State explicitly that runner status does not verify an oracle and conformance remains `not-reviewed` absent a cited human-authored finding.

- [x] **Step 4: Add hostile-text and stable-order tests; run renderer tests**

  Assert imported text cannot create Markdown links/headings or inject report instructions, bounded text remains bounded, and equal/missing timestamps preserve report order. Run the command from Step 2 and expect all renderer tests to pass.

### Task 4: Add the offline CLI and guarded output writes

**Files:**
- Create: `qa-harness/checks/qa-run-report.mjs`
- Create: `qa-harness/checks/qa-run-report.test.mjs`
- Modify: `qa-harness/fixtures/run-report/playwright-report.json`

**Interfaces:**
- CLI: `node qa-harness/checks/qa-run-report.mjs --report <file> --root <project> --investigation <id> --run-id <id> --target <name> --json-out <file> --markdown-out <file> [--revision <rev>] [--captured-at <ISO-time>] [--force]`.
- Produces stable exit codes: `0` report written (including failures), `2` invalid/unsupported input or usage, `3` I/O error.
- Run ID and target are required flags because Playwright JSON has no reliable standard for either; revision and capture time may be omitted and must then be recorded unknown. A report start time may populate `startedAt` only.
- Before rendering, CLI adds `runId`, `target`, `revision`, and `capturedAt` to normalized run metadata; absent optional values are `null`.

- [x] **Step 1: Add failing CLI tests for required arguments, bad JSON, metadata, and normal report generation**

  Invoke the CLI with `spawnSync(process.execPath, ...)` in temporary fixture roots. Assert usage errors are exit 2 with named missing flags; malformed JSON exits 2; valid input writes both outputs and exits 0 even when the run contains failures; supplied metadata is preserved.

- [x] **Step 2: Run CLI tests to verify they fail**

  Run: `node --test qa-harness/checks/qa-run-report.test.mjs`
  Expected: failure because the CLI is not implemented.

- [x] **Step 3: Implement CLI argument parsing, metadata merge, and pipeline**

  Read only the explicitly supplied report; parse JSON; invoke parser, coverage, and renderer; set metadata from flags and known report fields; do not infer target from report URLs. Require output paths and validate investigation ID/path boundaries before writing.

- [x] **Step 4: Add output-collision, `--force`, and path-boundary tests; implement atomic guarded writes**

  Assert existing outputs remain unchanged without `--force`, are replaced only with `--force`, and paths escaping the intended project root are rejected. Write both outputs through temporary sibling files and rename only after successful generation; clean temporary files after errors.

- [x] **Step 5: Run focused CLI and complete checker tests**

  Run: `node --test qa-harness/checks/qa-run-report.test.mjs qa-harness/checks/playwright-json.test.mjs qa-harness/checks/coverage-report.test.mjs qa-harness/checks/run-report-render.test.mjs qa-harness/checks/qa-check.test.mjs`
  Expected: all tests pass; existing checker tests remain unchanged.

### Task 5: Wire synthetic CI coverage and document the command

**Files:**
- Modify: `.github/workflows/qa-harness-check.yml`
- Modify: `qa-harness/checks/README.md`
- Modify: `qa-harness/README.md`
- Create: `qa-harness/fixtures/run-report/README.md`

**Interfaces:**
- CI runs the offline CLI against the synthetic run-report fixture, validates stable output assertions, then runs the existing complete Node test suite.
- Documentation provides a copyable command, input/output contract, exit codes, metadata rules, and limitations.

- [x] **Step 1: Add a failing workflow/documentation assertion**

  Extend the existing `qa-check.test.mjs` CI-scope test to require an offline run-report fixture invocation and keep both existing checker commands present; add a documentation assertion for required flags and the no-oracle-proof limitation.

- [x] **Step 2: Run the focused assertions to verify they fail**

  Run: `node --test qa-harness/checks/qa-check.test.mjs`
  Expected: failure because CI/docs do not yet describe run-report ingestion.

- [x] **Step 3: Add fixture invocation to CI and document usage**

  Keep existing `qa-check.mjs` fixture check intact. Run `qa-run-report.mjs` on the synthetic fixture with explicit metadata/output paths in a temporary directory; assert expected JSON and Markdown files and stable classifications. Document Node 20+, offline-only behavior, no test execution, report compatibility, output collision behavior, and that run status is not oracle conformance.

- [x] **Step 4: Run the full Node test suite and inspect the final diff**

  Run: `node --test qa-harness/checks/*.test.mjs` and `git diff --check`.
  Expected: all tests pass and the diff has no whitespace errors. Confirm no dependency files, consumer tests, raw report payloads, credentials, or edits to existing investigation artifacts were added.

## Execution Notes

- Implement one task at a time and preserve the interfaces listed above.
- Use the approved design document as the source for any behavior not repeated here.
- Keep the synthetic report and placeholder spec path clearly identified as fixtures; never run Playwright.
- Do not commit or push unless the user requests it after reviewing the completed phase.
