# Playwright Run Comparison Design

## Intent

Let a QA investigator compare two existing harness run reports for the same
investigation and target. The comparison should make changes in observed
execution outcomes easy to review while preserving the harness boundary: it
does not run Playwright, inspect a live application, decide whether an oracle
was checked, or infer why an outcome changed.

## User and use

After generating harness reports for two runs, the user selects an earlier
report as the baseline and a later report as the comparison. The harness emits
a JSON and Markdown comparison under the selected project root.

The user selected comparison of saved harness reports and explicitly requires
the reports to have the same target. Reports must also identify the same
investigation. A mismatch is an input error; the tool does not silently compare
different environments or investigations.

Compare stored investigation IDs and target strings exactly, without trimming
or URL/name normalization. This conservative rule avoids treating distinct
target labels as equivalent without an explicit project policy.

## Goals

- Compare the stored report evidence as it was recorded at each run.
- Align results by mapped test case ID and Playwright project name.
- Show each side's run ID, capture time, revision, target, status, and evidence
  locator where available.
- Label observed transitions plainly and expose missing or ambiguous evidence.
- Keep generation read-only with respect to source reports and investigation
  artifacts; only write the requested comparison outputs.
- Reuse the existing paired JSON/Markdown output and path-safety conventions.

## Non-goals

- Running Playwright or reading raw Playwright JSON during comparison.
- Rebuilding historical mappings from the current investigation files.
- Comparing different targets, investigations, test source revisions, or
  product environments.
- Inferring test additions/removals, root cause, product quality, or oracle
  conformance from runner outcomes.
- Replacing the existing single-run report or traceability matrix.

## Approaches considered

1. **Compare two saved harness reports (selected).** Uses each report's stored
   investigation ID, target, run metadata, `plan-test` mappings, and `test-run`
   links. This preserves the historical mapping and outcome evidence and fits
   the user's request.
2. **Compare two raw Playwright reports.** Would need investigation metadata
   and mapping resolution at comparison time, risking reinterpretation of old
   runs using changed files. It duplicates report-generation behavior.
3. **Regenerate two reports from current investigation artifacts.** This
   would make historical comparison dependent on present-day plans and risks,
   so it could misstate what each original report actually recorded.

The selected approach compares saved harness reports only.

## Stored report interpretation

The current harness run report uses schema version 2. A comparison accepts two
valid version-2 harness report JSON files. Each must contain an investigation
ID, run metadata including non-empty run ID and target, coverage links, and
outcome data in the existing report shape. The implementation should validate
the fields it consumes and reject malformed reports with a useful input error.

Only stored `coverage.links` with `kind: "plan-test"` and `kind: "test-run"`
are mapping/execution evidence. The current `test-run` link does not store a
project name; join it to exactly one entry in the same report's `tests[]` by
the link's `toId` or `targetLocator` matching `tests[].sourcePointer`. Read the
project name and normalized status from that test entry, and require its status
to agree with the link's `runStatus`. A mismatch or non-unique join is
ambiguous. `test-run.fromId` supplies the case association; `plan-test.fromId`
supplies its mapped-file evidence. Source pointers remain visible as locators.
The comparison must not infer matches from titles, file paths, current plans,
or similar-looking test names.

The current report producer may preserve an empty or null `tests[].projectName`
while omitting it from `run.projectNames`. Include one anonymous project key in
the comparison when either report has such a test. If a linked result joins to
that anonymous key, preserve its status and source pointer but mark its
evidence `ambiguous`; never compare anonymous results as if their project
identity were known. Display this key as “unknown project” in Markdown.
Optional run provenance fields `revision`, `capturedAt`, `startedAt`, and
`source` must be absent, null, or strings before they are copied into output.

### Evidence and classifications

Each output row represents a case ID and project name found in either report's
stored plan-test or test-run evidence. Use the union of both reports' case IDs
and project names; `run.projectNames` supplies each report's configured
projects, and an anonymous project key is added when the report's test list
contains an empty or null project name. For each side, preserve one of these
states:

- `observed`: exactly one usable test-run link exists and supplies its stored
  status and source pointer.
- `no-result`: the report includes an unambiguous plan-test mapping but has no
  test-run link for that case/project.
- `unmapped`: the report has no plan-test evidence for the case.
- `project-not-included`: the report's run metadata does not list this project.
- `ambiguous`: multiple conflicting mappings or multiple test-run links make
  a single outcome unsafe to select, including a uniquely linked result whose
  project name is empty or null.

For a case/project pair, use this precedence: project not included; case
unmapped; mapping ambiguous; one observed test-run link; otherwise no result.
The current saved report normalizes runner statuses to `expected`, `failure`,
`skipped`, `flaky`, or `unknown`. A project/case row is `observed` only when its
single test-run status is one of those recognized values.

Treat plan-test links for one case as identical only when their `status`,
`toId`, and `targetLocator` match; ignore exact duplicates and mark distinct
mapping identities ambiguous. Treat test-run links as identical only when
their `runStatus`, `toId`, and `targetLocator` match; deduplicate exact copies
and mark multiple distinct links for one case/project ambiguous, even when
their statuses happen to agree. Do not aggregate multiple results into a
synthetic outcome.

Classify outcome changes only when both sides are `observed`:

- same status: `unchanged`
- `expected` to `failure` or `flaky`: `regressed`
- `failure` or `flaky` to `expected`: `recovered`
- every other status transition: `changed`

When either side is not `observed` (including `project-not-included`), use
`not comparable` and state the evidence condition. Do not label one-sided
evidence as a test added or removed, or as a failure or recovery. `expected`
means the runner reported a passing outcome. The names `regressed` and
`recovered` describe only runner-status transitions, not oracle correctness or
product quality.

## Output and command shape

Add a `compare` subcommand to the existing
`qa-harness/checks/qa-run-report.mjs` CLI, using the existing project-root and
paired-output conventions. Proposed invocation:

```text
node qa-harness/checks/qa-run-report.mjs compare --root <project> --before <baseline-run-report.json> --after <later-run-report.json> --json-out <file> --markdown-out <file> [--force]
```

The command writes a comparison JSON and Markdown pair, refuses to overwrite
either input report, validates output paths stay within the project root,
requires distinct outputs, and uses existing `--force` semantics for replacing
prior outputs. It creates no directories. The JSON output records schema
version, comparison generation time, both reports' metadata, and all comparison
rows. Markdown summarizes metadata and counts by classification, then lists
case/project rows with before/after statuses, evidence state, classification,
and source pointers. Escape untrusted values using the existing Markdown text
conventions.

## Documentation and verification scope

Update the checks README, root README, and architecture entry-route/tool
descriptions to show offline comparison of two saved reports and reiterate its
same-investigation/same-target requirement and runner-outcome limitation.

Add focused Node tests and fixtures for same-target acceptance; target and
investigation mismatch; transition classifications; no-result, unmapped, and
ambiguous evidence; malformed or unsupported report input; output path/input
protection; and nested output-directory report links. The last case covers the
previously deferred CLI success-path check that attachment links remain
relative to a Markdown report written into a nested directory. Do not add
Playwright test code or perform a live browser run.

## Risks and limits

- A stored `passed` status means only that the runner reported pass; it does
  not establish assertion quality, oracle conformance, or root cause.
- If run reports were generated with different historical mappings, rows may
  be `unmapped` or `not comparable`; the comparison must show this rather than
  reinterpret either report.
- The fixed report schema is versioned. Unsupported schemas should fail clearly
  until an explicit compatibility rule is designed.

## Builder decisions

The builder may choose the smallest module/test organization consistent with
existing checks conventions. Preserve all comparison semantics and safety
requirements above. Do not add dependencies, report discovery, interactive
prompts, or other options.
