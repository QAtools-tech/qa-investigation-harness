# Walkthrough: existing spec and failed run

This synthetic walkthrough checks direct plan review and failure triage. It
does not claim the report came from a real application, and it does not
contain executable test code.

## Start from the supplied evidence

Open a fresh chat with the repository and provide:

- [`filter-plan.md`](../fixtures/filter-plan.md)
- [`run-evidence.md`](../fixtures/walkthroughs/spec-failed-run/run-evidence.md)

Say:

> This existing filter plan has a reported failed run. Choose the right
> investigation entry point. Tell me what the run establishes, what it does
> not establish, and what evidence is missing. Do not create approvals,
> mappings, or tests.

The failure evidence should route to **Triage**. The supplied facts establish
that a run reported the Closed row visible after selecting Open. They do not
establish why it happened or that the current expected behavior is approved.
The plan itself has a conflict about when filtering takes effect. Name the
missing assertion source, setup/fixture state, retry history, and code revision
before proposing a cause.

Now ask:

> Audit this as an approved-risk validation. What do you need before you can
> make that judgment?

The harness must stop: there is no human decision, generated mapping, or test
source in the supplied evidence. Name each missing item and its next owner.
Do not turn the failed run into a fabricated risk, approval, or conformance
finding. Keep the plan source unchanged and keep observed failure separate
from possible causes.

## Optional offline report check

The separate Phase 6 CLI can normalize the synthetic Playwright report and
show coverage limits. Run it against a temporary copy so fixture files stay
unchanged. Copy `qa-harness/fixtures/run-report/qa-artifacts/` and
`qa-harness/fixtures/run-report/specs/` into the temporary root. Do not copy
`qa-harness/fixtures/run-report/tests/filter.spec.ts`; omitting that empty
locator placeholder makes the mapped test source explicitly absent in this
scenario.

PowerShell, from the repository root:

```powershell
$runRoot = Join-Path $env:TEMP "qa-run-walkthrough-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $runRoot | Out-Null
Copy-Item qa-harness/fixtures/run-report/qa-artifacts $runRoot -Recurse
Copy-Item qa-harness/fixtures/run-report/specs $runRoot -Recurse
node qa-harness/checks/qa-run-report.mjs --report qa-harness/fixtures/run-report/playwright-report.json --root $runRoot --investigation CASE-300 --run-id RUN-701 --target synthetic-staging --revision fixture-rev-1 --json-out qa-artifacts/CASE-300/run-report.json --markdown-out qa-artifacts/CASE-300/run-report.md
```

Bash, from the repository root:

```bash
run_root="$(mktemp -d)"
cp -R qa-harness/fixtures/run-report/qa-artifacts "$run_root/"
cp -R qa-harness/fixtures/run-report/specs "$run_root/"
node qa-harness/checks/qa-run-report.mjs --report qa-harness/fixtures/run-report/playwright-report.json --root "$run_root" --investigation CASE-300 --run-id RUN-701 --target synthetic-staging --revision fixture-rev-1 --json-out qa-artifacts/CASE-300/run-report.json --markdown-out qa-artifacts/CASE-300/run-report.md
```

Inspect `run-report.md` in the temporary root. It should preserve the runner's
failed result, identify the missing mapped test source and unresolved TC-02
mapping, and retain provenance limitations. It must not claim the oracle was
checked or infer a root cause. Run status comes from the fixture; run ID,
target, and revision are labels supplied by this walkthrough.

The fixture under `qa-harness/fixtures/run-report/` contains only an empty
placeholder at the mapped source path and is not executable Playwright code.
The copied scenario deliberately omits it. No fixture is modified by either
command.

## First-run record

Record the selected entry point, the observed fact, every named missing input,
the approved-risk audit stop, and whether the offline report exposed its
unresolved mapping and missing test source. Keep report metadata supplied by
the caller distinct from metadata present in the synthetic runner report.
