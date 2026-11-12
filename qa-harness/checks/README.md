# Deterministic QA artifact checks

The optional checker is a read-only structural check for Phase 3
`investigation.md` imports, Stage 3 risk tables, and generated mappings. It
reports file and line locations. It does not infer approval, evaluate oracle
quality, decide freshness, export plans, edit artifacts, or author tests.

## Manual use

Requires Node.js 20 or newer; no package install is needed.

```sh
node qa-harness/checks/qa-check.mjs
node qa-harness/checks/qa-check.mjs --root path/to/consuming-project
node --test qa-harness/checks/*.test.mjs
```

With no `qa-artifacts/` directory, the checker reports that there is nothing
to check and exits successfully. The checker validates every direct
`qa-artifacts/<id>/investigation.md` and `risks.md` it finds. It checks risk
IDs, required fields, allowed statuses, and mappings against the canonical
`specs/<id>.plan.md` TC IDs. It never changes the source files.

## Optional Codex hook

`../hooks/codex-hooks.example.json` is an opt-in example for Codex's local
`PostToolUse` event after `apply_patch`. Review the command and copy its
contents to `.codex/hooks.json` only when you want automatic diagnostics.
Project hooks require trust review in Codex; inspect the hook with `/hooks`
before trusting it. It is not a policy boundary: the edit already happened
before `PostToolUse` runs. Malformed hook input fails open with manual-check
guidance. The hook returns diagnostics as context and never blocks, edits, or
approves.

The hook checks only Codex `apply_patch` tool activity. Shell-based edits and
other clients should run the manual command. CI runs the same checker against
the synthetic fixture and runs its Node test suite.

## Limits

The checker covers structure only. `status`/`resume` remain authoritative for
approval freshness and next-action routing. Human review remains authoritative
for risk decisions and expected behavior.

## Offline Playwright run report

`qa-run-report.mjs` reads one existing Playwright JSON reporter file and one
investigation's Markdown artifacts. It does not invoke Playwright, run tests,
access a browser, call a provider, or use a model. Requires Node.js 20+; no
package install is needed.

```sh
node qa-harness/checks/qa-run-report.mjs \
  --report test-results/report.json \
  --root . \
  --investigation CASE-300 \
  --run-id build-184 \
  --target staging \
  --revision abc123 \
  --json-out qa-artifacts/CASE-300/run-report.json \
  --markdown-out qa-artifacts/CASE-300/run-report.md
```

The report input may be anywhere the caller can read. Output paths must be
inside the selected project root, their parent directories must already exist,
and the JSON and Markdown paths must differ. Existing output files are
preserved unless `--force` is supplied. The command writes both outputs via
temporary sibling files and restores prior outputs if the write transaction
fails.

`--run-id` and `--target` are required because Playwright JSON does not define
a reliable standard value for them. `--revision` and `--captured-at` are
optional; omitted values remain unknown. The Playwright report's `stats.startTime`
is retained as run start time when present. Exit code `0` means the report was
written, even if it contains failures; `2` means usage or selected-input
problems; `3` means an output or operational I/O error.

Coverage uses exact case/requirement references, risk decision records,
generated mappings, and plan TC headings. A reported title may link by a
standalone `TC-<digits>` token or by exact complete title path. Both require
the run test file to match the mapped file.
Ambiguous and missing links remain visible. Requirement-to-risk coverage is
only linked when a risk row has an explicit `Requirement IDs` column reference;
the tool does not infer links from similar prose. Freshness requires a match
for the reviewed risk and oracle and every recorded dependency. The report
can compare `filename@sha256:<digest>` for the current investigation, flow
model, and exploration files. A differing flow-model date can establish
staleness, while a matching date alone leaves freshness unknown. Conformance
is `not-reviewed` unless a Stage 5 validation row includes the TC ID, finding,
and source locator.

The JSON and Markdown reports retain normalized result references and raw
runner outcome categories, not full attachments, stdout, or error payloads.
Runner status does not verify an oracle. The report does not label a run,
test, or suite healthy or adequate, and does not infer a failure's root cause.
Possible causes remain empty until a human supplies a cited hypothesis.

## Traceability matrix

The matrix is a read-only, one-investigation view of requirements, risks,
decisions, planned cases, mapped test files, selected-run outcomes, and Stage 5
validation. It accepts no run and reports “no run selected”; it never invokes
Playwright or changes investigation artifacts.

```sh
node qa-harness/checks/qa-run-report.mjs matrix --root . --investigation CASE-300
```

To export a pre-run matrix:

```sh
node qa-harness/checks/qa-run-report.mjs matrix --root . --investigation CASE-300 \
  --markdown-out qa-artifacts/CASE-300/matrix.md --csv-out qa-artifacts/CASE-300/matrix.csv
```

To reconcile one selected report, supply its run ID and target:

```sh
node qa-harness/checks/qa-run-report.mjs matrix --root . --investigation CASE-300 \
  --report test-results/report.json --run-id build-184 --target staging --revision abc123 \
  --markdown-out qa-artifacts/CASE-300/matrix.md --csv-out qa-artifacts/CASE-300/matrix.csv
```

The matrix keeps freshness, mapping, execution per Playwright project, and
validation separate. Missing and ambiguous evidence stays visible. CSV cells
are quoted and formula-like imported values are prefixed for spreadsheet
safety. Existing outputs require `--force`; outputs cannot replace the selected
Playwright report.

The synthetic fixture under `../fixtures/run-report/` exercises report parsing,
coverage gaps, and triage without using project test data. CI runs the fixture
scenario and the full Node test suite.
