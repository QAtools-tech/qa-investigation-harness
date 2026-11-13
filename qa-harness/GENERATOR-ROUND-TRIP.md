# Generator round trip

Use this guide to continue an approved investigation through your project's
test generator and return its generated source and Playwright results to the
harness. Replace the example investigation, paths, run ID, target, and revision
with values from your project. If a value is unknown, omit it where optional;
do not guess.

The consuming project owns test generation and Playwright execution. The
harness prepares the plan, reads generated files and reports, and reviews
assertions against human-approved oracles. It does not invoke your generator or
run your tests.

## 1. Confirm the handoff is ready

Use `status <id>` or `resume <id>` and resolve any approval, freshness, plan,
or mapping blocker first. Only current human-approved risks may be handed off.
The canonical plan is `specs/<id>.plan.md`; approved risk-to-TC-to-file mappings
are recorded in `qa-artifacts/<id>/risks.md`.

From the harness checkout, print the read-only handoff summary:

```sh
node qa-harness/checks/qa-run-report.mjs handoff --root "/path/to/consuming-project" --investigation CASE-300
```

Replace the example path with the consuming project's absolute path in your
shell's native format.

The summary separates ready and blocked cases. It writes no artifact. If a
case is blocked by stale approval or a plan/mapping mismatch, stop for human
review. The summary can also mark a mapped file as missing before generation;
that is the expected generator handoff state, not a reason to change the
mapping or approval. In that case, use the status/resume next action and give
the external generator the approved plan below. The resolver's
[generator-handoff row](stages/00-status-and-resume.md) remains authoritative
for when generation may proceed.

Give the consuming project's generator the approved plan at
`<project-root>/specs/CASE-300.plan.md`, following that generator's own setup.
The plan is the generator input. Do not ask this harness to write or repair
test code.

## 2. Confirm generated source matches the mapping

After the generator finishes, check the mapped files from the consuming
project root. From the harness checkout, run the matrix against that project:

```sh
node qa-harness/checks/qa-run-report.mjs matrix --root "/path/to/consuming-project" --investigation CASE-300
```

Replace the example path with the consuming project's absolute path in your
shell's native format.

The matrix checks mapped paths and reports missing or ambiguous mappings. A
plan or mapping alone does not prove that a test file was generated. If the
mapped file is absent, ask the project owner to restore or regenerate it. If
the generator wrote a different file, have a human reconcile the approved
mapping before continuing. Do not silently change the map.

## 3. Run tests in the consuming project

Run the mapped tests with the consuming project's usual Playwright command and
scope. Save the existing Playwright JSON reporter output somewhere readable by
the harness command below. Keep the report associated with its actual run ID,
target, and code revision when those values are known.

The harness does not start Playwright. A missing report or test result is
missing evidence, not a test failure.

## 4. Import the Playwright report

From the harness checkout, import the existing Playwright JSON report. Set
`--root` to the consuming project root, which contains `qa-artifacts/`,
`specs/`, and the mapped tests. The report input can be at another readable
path; output files must stay inside the selected root and their parent
directories must already exist. The CLI resolves output arguments from the
current working directory, not from `--root`, so use absolute output paths
under the consuming project root when running it from a separate harness
checkout. Quote paths if they contain spaces.

```sh
node qa-harness/checks/qa-run-report.mjs \
  --report "/path/to/consuming-project/test-results/report.json" \
  --root "/path/to/consuming-project" \
  --investigation CASE-300 \
  --run-id build-184 \
  --target staging \
  --json-out "/path/to/consuming-project/qa-artifacts/CASE-300/run-build-184.json" \
  --markdown-out "/path/to/consuming-project/qa-artifacts/CASE-300/run-build-184.md"
```

Replace each `/path/to/consuming-project` with the actual absolute path. The
input report may instead use any path the caller can read.

`--run-id` and `--target` are required because the Playwright JSON does not
provide reliable values for them. Add `--revision <value>` when the code
revision is known; otherwise leave it out. If the run ID or target is unknown,
stop and request the actual value before importing; do not guess. Choose new
output names for each run. Existing outputs are preserved unless `--force` is
supplied. The importer preserves raw runner outcomes and does not judge oracle
conformance.

## 5. Review run evidence and assertions

Build a matrix with the same raw Playwright report to see execution alongside
the approved mappings. Keep the run ID and target the same as the import above:

```sh
node qa-harness/checks/qa-run-report.mjs matrix \
  --root "/path/to/consuming-project" \
  --investigation CASE-300 \
  --report "/path/to/consuming-project/test-results/report.json" \
  --run-id build-184 \
  --target staging \
  --markdown-out "/path/to/consuming-project/qa-artifacts/CASE-300/matrix-build-184.md" \
  --csv-out "/path/to/consuming-project/qa-artifacts/CASE-300/matrix-build-184.csv"
```

Replace the example absolute paths with the same project root and report used
for the import.

A reported `expected` result means the runner reported a pass; it does not
establish that the generated assertion checks the approved oracle. A missing
matching test result is not comparable execution evidence.

Continue QA for the same investigation and provide the consuming-project root
or mapped test source location if it is not otherwise accessible. Route to
[Stage 5](stages/05-validate.md) Part A to compare each generated assertion
with its approved oracle and record cited findings. Stage 5 Part B is
opt-in; it must never run implicitly. The human decides whether a finding
warrants asking the consuming project's generator to revise a test.

For a before/after comparison, use the two saved harness run-report JSON files
with the existing `compare` command. Both reports must belong to the same
investigation and exact target. Not-comparable rows retain their evidence
states and reasons; they are not regressions or recoveries.

## If the return path is blocked

- **No current approval or mapping:** return to `status <id>` and resolve the
  named human review or artifact mismatch before generating.
- **Mapped source is missing:** ask the consuming project to restore or
  regenerate the mapped test; do not claim a test exists from its plan entry.
- **Mapped path differs from generator output:** ask a human to reconcile the
  mapping; do not silently remap an approved risk.
- **No matching result in the report:** confirm the right report, project, and
  test scope; do not label the case failed.
- **Assertion has not been reviewed:** route to Stage 5 Part A. Runner status
  alone cannot establish conformance.

See [the offline run-report instructions](checks/README.md) for importer,
matrix, and comparison behavior, and [the status/resume resolver](stages/00-status-and-resume.md)
for the full eligibility rules.
