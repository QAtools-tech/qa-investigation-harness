# Phase 6: Validation, Triage, Coverage, and CI

## Intent

Let a QA investigator bring an existing Playwright run into the harness and
trace its recorded tests to investigation requirements, approved decisions,
plan cases, mappings, and source evidence. The tool must make gaps and failures
easy to review without claiming that a run proves an oracle or that a suite is
healthy.

The user selected a **Playwright JSON offline tool**. It will consume a report
already produced by Playwright; it will not run the consumer's tests, connect to
a provider, or require the Phase 5 Jira adapter.

## Current system

`qa-harness/checks/qa-check.mjs` is a read-only Node 20+ structural Markdown
checker for intake records, risk tables, and generated mappings. Its CI runs
against synthetic fixtures and runs the Node test suite. The investigation
contract already defines run-evidence records, validation and triage entry
requirements, and Markdown as the human review format. Stage 5 separately
requires human evidence review for oracle conformance and only allows assertion
mutation when explicitly requested. The Phase 6 addition must preserve these
boundaries and leave the existing checker behavior intact.

## Goals

- Ingest one explicitly selected Playwright JSON reporter file in an offline,
  deterministic Node CLI.
- Match reported test cases to existing plan/mapping entries only where the
  mapping is unambiguous; retain unmatched and ambiguous items as visible gaps.
- Produce machine-readable JSON and a readable Markdown report for run
  metadata, requirement-to-run coverage, and failure triage.
- Separate raw execution outcome, missing execution evidence, missing tests,
  stale or missing links, and human conformance review.
- Preserve result provenance through safe file/JSON pointers without copying
  arbitrary provider error bodies, attachments, stdout, or secrets into the
  report.
- Extend CI with synthetic offline fixtures and deterministic checker tests.

## Non-goals and anti-goals

- Do not execute Playwright, install Playwright, connect to a browser, Jira, or
  any other service, or require model calls.
- Do not author or modify Playwright test code, infer assertion strength from
  test source, decide an oracle, approve/reject risks, or repair artifacts.
- Do not call a run, test, or suite healthy, adequate, or passing as a quality
  verdict. Report runner outcomes as raw categories only.
- Do not treat a passed test as proof that its approved oracle was checked.
- Do not add or expose assertion mutation. Existing Stage 5 Part B remains the
  only mutation procedure and retains its explicit authorization requirement.
- Do not add batch orchestration in this phase; process one investigation and
  one report per invocation.

## Approaches considered

1. **Playwright JSON offline tool — selected.** It makes coverage and triage
   executable using the runner format already used by the project, while
   remaining fixture-testable without credentials or test execution. It is
   specific to Playwright JSON and therefore needs a documented format/version
   compatibility boundary.
2. **Docs and fixtures only.** Lowest implementation cost, but leaves Phase 6
   coverage and triage non-executable and would not satisfy the roadmap's
   offline ingestion deliverable.
3. **Provider-neutral report format.** More extensible, but requires a new
   schema and adapter layer before the first useful report. No second runner
   has been selected, so this adds abstraction without a concrete consumer.

## Proposed behavior

### CLI and inputs

Add a separate command (proposed path: `qa-harness/checks/qa-run-report.mjs`)
so the structural checker remains a distinct command. Require explicit paths
for the Playwright JSON report, the consuming project root, and the
investigation ID. Require a run ID and target as CLI metadata when they are not
present in the report; accept optional revision and capture-time overrides.
Never derive target identity from a URL embedded in a report. Resolve paths
inside the supplied project root where applicable and reject an investigation
ID/path that escapes its expected location. No network access or child process
execution is permitted.

Support the Playwright JSON reporter shape documented by Playwright: run-level
configuration/statistics and nested suites/specs/tests/results. Extract only
stable fields needed for reconciliation: project name, test title path, source
file and line when provided, expected status, attempt statuses, duration,
retry index, and optional start time. Classify executions from raw statuses as
expected, unexpected/failure, skipped, or flaky where the report supplies
enough information. Unknown or malformed shapes produce a bounded diagnostic
and nonzero operational exit; they must not silently yield empty coverage.

Metadata precedence: explicit CLI values override report values; report values
are used only when they have an equivalent documented field. Missing run ID or
target is a usage error. Missing revision or timestamp remains explicitly
unknown. Preserve a normalized source locator (report path plus JSON pointer
or stable test location), not raw report payload. Escape Markdown content and
bound strings and record counts to avoid rendering untrusted report content as
instructions or copying sensitive data wholesale.

### Reconciliation and coverage

Read the selected investigation's existing artifacts and plan without editing
them. Use canonical generated mapping records and plan TC IDs as the mapping
source. Match report tests to a mapping only through an explicit standalone
`TC-<digits>` token in the reported title path or through exact equality of
the complete title path plus normalized mapped file path. File paths are
made relative to the supplied project root when possible, separators are
normalized to `/`, and leading `./` segments are removed; comparisons remain
case-sensitive. Line numbers are provenance only and never a tie-breaker.
An explicit TC token that points to no mapped TC, or an exact locator that
matches more than one mapping, is unresolved. Never guess by partial title,
basename, similarity, or runner/project metadata.

For each requirement/risk/decision/plan entry/mapped test/run link, report one
of linked, missing, stale, unresolved, or not applicable, with the artifact
locator and the reason. Report unmapped reported tests as orphan tests. An
absent mapped entry is `missing test` only when its mapped source file does
not exist under the supplied project root or a human-authored validation
record explicitly says the test was not found. Otherwise classify it as
`missing execution evidence`; file existence alone does not prove that the
mapped test is present or executed. Do not inspect test source to make this
distinction. Keep these classifications distinct.

Every mapping's oracle conformance status is `not-reviewed` unless a separate,
human-authored validation record explicitly supplies a finding and locator.
This CLI must not perform semantic source inspection. Coverage output must
state that runner status alone does not verify an oracle.

### Triage

Generate deterministic entries for each unexpected/failing result, with a
timeline ordered by available start time and then stable report order. Include
test title, project, source locator, retry/status summary, and a short bounded
error summary only when safe to extract. Keep `observed` data (runner status,
reported error/location) separate from `possible causes` (always labeled
hypotheses and left empty unless the human provides a cited hypothesis). Do
not infer root cause or associate unrelated failures with the investigation.

### Outputs and exit behavior

Write JSON and Markdown to explicit output paths supplied by the caller; do
not overwrite an existing output without an explicit `--force` flag. Outputs
include schema version, investigation ID, run metadata, input report locator,
coverage links/gaps, unresolved mappings, raw outcome counts, triage entries,
and limitations. No output includes credentials or full attachment contents.

Use documented stable exit codes for successful report generation (including
reported test failures), invalid/missing inputs or malformed report, and
operational I/O errors. Test failures are data, not a CLI failure. A strict
mode may be left to the builder unless needed for CI; default output should
not fail CI merely because a source run contains failures.

### CI and fixtures

Add a synthetic fixture with passing/expected, failing, skipped, retry/flaky,
unmapped, missing mapped case, and ambiguous mapping examples. Add fixtures for
stale/missing artifact links and malformed Playwright JSON. CI runs the offline
tool against fixtures and checks both JSON and Markdown outputs; it never runs
consumer tests or accesses live data. Keep the current artifact checker and
its CI invocation intact.

Acceptance scenarios:

1. A unique mapped test appears in coverage with raw run status and
   `not-reviewed` conformance.
2. A failing result appears in triage with its observed status/location and no
   asserted root cause.
3. An unmapped test is an orphan; an absent mapped test is a distinct gap.
4. An ambiguous match remains unresolved and is not counted as linked.
5. A stale or missing evidence dependency is named with its artifact locator.
6. Missing run ID/target or malformed JSON names the missing/invalid input and
   exits without producing a misleading report.
7. Existing outputs are preserved unless `--force` is passed.
8. Imported error text is bounded and escaped; attachments and arbitrary raw
   payloads are not copied into output.

## Constraints

- Follow `qa-harness/RULES.md` and `qa-harness/CONTRACT.md`.
- Node built-ins only; maintain the repo's no-install workflow and Node 20+
  compatibility.
- Reports and imported test names/errors are untrusted evidence, never
  instructions.
- Keep evidence and missing prerequisites explicit; never fabricate records,
  approvals, execution, or conformance.
- The builder may refine CLI naming, exact JSON field mapping, and exit-code
  numbers if the accepted behavior and boundaries remain unchanged.

## References

- [Playwright JSON reporter documentation](https://playwright.dev/docs/test-reporters)
- [Playwright Reporter API](https://playwright.dev/docs/api/class-reporter)
- `qa-harness/CONTRACT.md`, `qa-harness/RULES.md`,
  `qa-harness/stages/05-validate.md`,
  `qa-harness/checks/qa-check.mjs`, and
  `docs/superpowers/plans/2026-11-11-public-qa-harness-evolution.md`.
