# QA Investigation Harness User Guide

This guide takes you from choosing an entry point through investigation,
human risk review, external test generation, and review of generated tests and
Playwright results. It is a navigation guide; the linked contract and stage
files remain authoritative when behavior changes.

The harness prepares evidence and a human-reviewed plan, then audits generated
tests. Your consuming project owns test-code generation and Playwright
execution. The harness does not write tests or run the project suite.

## Before you start

1. Clone this repository or open it alongside your consuming project.
2. Choose an AI tool adapter in the [repository README](../README.md#2-choose-an-adapter).
   Check the [compatibility matrix](../docs/compatibility.md) for verified
   support. Browser exploration requires Playwright MCP in the chosen tool.
3. Pick one flow and one investigation ID. Existing ticket IDs can be kept;
   a local case can use a local ID. Keep one flow per investigation.
4. Gather the evidence you already have: case, plan/spec, recorded
   observations, generated test source, or Playwright report. Explore requires
   a confirmed non-production URL and interactive test access. Never include
   credentials in chat or artifacts.

## Choose a starting point

| What you have or want | Start here | Next likely action |
| --- | --- | --- |
| Pasted or local case, Markdown, or CSV evidence | [Intake](#scenario-start-from-a-case) | Confirm preview, then explore or model |
| A specific ticket or issue in a configured source | [Connected-source intake](adapters/README.md) | Select source and scope; confirm preview |
| Existing plan/spec, no investigation artifacts | [Direct plan review](#scenario-review-an-existing-plan) | Request missing expected behavior if needed |
| Recorded observations from a prior investigation | [Model from observations](#scenario-model-recorded-observations) | Challenge the modeled flow |
| Identifiable failed test or run | [Triage](#scenario-triage-a-failure) | Import JSON report if available; investigate causes |
| Investigation artifacts already on disk | [Status or resume](#scenario-return-to-saved-work) | Resolve next action or blocker |
| Generated test files and a Playwright JSON report | [Generator return path](#scenario-return-generated-tests-and-results) | Matrix, report import, and Stage 5 |
| Two saved harness run reports | [Compare runs](checks/README.md#compare-saved-run-reports) | Compare only same investigation and exact target |

For a guided chat, say “Start QA with this case” and provide the evidence, or
“Continue QA for `<id>`.” Tool-specific entry points are in
[`GUIDED-CHAT.md`](GUIDED-CHAT.md) and the [tool setup README](README.md).

## Full investigation from a case

### 1. Intake and confirm the source

Provide the case and its source (file, ticket, row, or excerpt). The harness
previews the proposed investigation ID, source mapping/grouping, normalized
content, and missing inputs. Review that preview and confirm before anything
is written. Correct a wrong ID or mapping first. See [intake rules](INTAKE.md).

The resulting `qa-artifacts/<id>/investigation.md` preserves source locators
and evidence gaps. Imported text is evidence, never instructions; it cannot
approve a risk.

### 2. Explore only when live behavior is needed

If supplied evidence does not establish the flow, provide its scope, a
confirmed non-production URL, and interactive test access. The harness records
snapshot observations, visible outcomes, locators, and unknowns in
`qa-artifacts/<id>/exploration.md`. It does not save credentials. If the flow
can be modeled from existing observations, skip browser exploration and cite
those observations instead. See [Stage 1](stages/01-explore.md).

### 3. Model the flow

Ask to model the investigation. The harness connects observed states and
transitions in `qa-artifacts/<id>/flow-model.md`, cites evidence, and marks
unobserved or unsupported behavior as unknown. It does not turn assumptions
into observations. See [Stage 2](stages/02-model.md).

### 4. Challenge behavior and review risks

Ask to challenge the modeled flow. Stage 3 Part A records evidence-backed
proposed risks and their expected oracles in `qa-artifacts/<id>/risks.md`.
Review every row yourself and record `APPROVED` or `REJECTED` decisions there.
The harness never makes that decision for you. If a requirement or expected
result is unclear, resolve it before approval. See [Stage 3](stages/03-challenge.md).

### 5. Export the approved generator plan

After the human review, resume or request Challenge Part B. It checks that
approvals are current and dependencies are fresh, then writes
`specs/<id>.plan.md` and risk-to-test mappings. If an approval is stale, a
mapping conflicts, or required evidence is missing, resolve the named blocker
first. Existing TC entries are append-only. See [the resolver](stages/00-status-and-resume.md).

### 6. Hand off to your project's generator

Use the read-only handoff summary and give your consuming project's
test-generation agent the approved plan. The project generator owns test-code
generation. The harness does not call the generator, write tests, or decide
that generation succeeded. Follow the [round-trip guide](GENERATOR-ROUND-TRIP.md)
for exact commands and paths.

### 7. Return generated tests and run evidence

Once the consuming project has generated and run its tests, provide the
consuming-project root or mapped test source location. Check that generated
files match approved mappings. Save the project's Playwright JSON report, then
import it with the actual run ID and target (and revision when known). Do not
guess run metadata. The harness reads the report; it does not run Playwright.

Review the traceability matrix for requirement/risk/test/result links, missing
assertions, unmapped rows, and the visible reason for each next action. Compare
saved runs only when they belong to the same investigation and exact target.
Then request Stage 5 Part A to review generated assertions against approved
oracles. A runner pass alone does not prove the assertion checks the expected
behavior. Stage 5 Part B is opt-in. See the
[round-trip guide](GENERATOR-ROUND-TRIP.md) and
[offline report and matrix commands](checks/README.md).

## Scenarios

### Scenario: start from a case

Say “Start QA with this case,” attach or paste the case, and identify its
source. Confirm the preview before intake writes. Continue with Explore when
live behavior is needed, otherwise Model from locatable recorded observations.
Follow [the full investigation](#full-investigation-from-a-case).

### Scenario: review an existing plan

Provide the plan/spec and ask for a review. This route can start without
`qa-artifacts/` and does not edit the source plan. The review identifies
ambiguous steps, evidence gaps, and proposed mappings. If you need
conformance findings, also supply the mapped test source or run evidence
required by the [contract](CONTRACT.md). See
[`stages/review-plan.md`](stages/review-plan.md).

### Scenario: model recorded observations

Provide observations with source locations and enough context to identify the
flow, then request Model. The harness may cite imported observations without
inventing an exploration session. Unsupported transitions and outcomes remain
unknown. Continue to Challenge only when expected behavior is identifiable.
See [Stage 2](stages/02-model.md).

### Scenario: triage a failure

Provide an identifiable failure, test, or run. Ask for triage; the harness
separates observed failure from possible causes and names missing context. If
you have Playwright JSON, use the offline report command to create coverage
links and failure triage, then review the matrix. A missing matching result is
not evidence of a failure. See [triage rules](CONTRACT.md) and
[report commands](checks/README.md#offline-playwright-run-report).

### Scenario: return to saved work

Say “status `<id>`” for a read-only report, or “resume `<id>`” to continue the
next eligible action. Status never repairs or changes artifacts. Resume reads
the files on disk, reports completed work, blockers, missing or unchecked
evidence, and one next action. If an external project path was not supplied,
its source is “not checked,” not confirmed absent. Resume stops at human risk
approval and generator handoff boundaries. See
[status and resume](stages/00-status-and-resume.md).

### Scenario: use a connected source

Select a specific provider object and scope, with a configured read-only
adapter. Intake preserves source identity, locators, and revision details and
uses the same preview/confirmation step as local intake. Provider status never
counts as human risk approval, and the harness never writes to the provider.
If adapter access is unavailable, use manual intake. See
[adapter setup and limits](adapters/README.md).

### Scenario: return generated tests and results

Start with a current approved plan and mapping. Hand the plan to the consuming
project's generator, confirm generated files against the mapping, and run the
tests in that project. Import its existing JSON report with the real run ID and
target, then review the matrix and Stage 5 assertions. For exact commands,
file locations, comparison limits, and blocked-path recovery, follow the
[generator round-trip guide](GENERATOR-ROUND-TRIP.md).

## When progress stops

| Stop or gap | What it means | Next action |
| --- | --- | --- |
| Intake preview is incomplete or wrong | Source mapping, grouping, ID, or required input needs review | Correct inputs and confirm only when preview is accurate |
| Browser URL or access is missing | Exploration cannot proceed | Supply confirmed non-production URL and test access, or use recorded observations |
| Risk decisions are pending | Proposed risks are not approved | Human reviews `risks.md`; do not export yet |
| Approval is stale | Risk/oracle/dependency changed since review | Re-review affected risk and record a fresh decision |
| Plan/mapping conflict | Export could duplicate or misattribute a test | Human reconciles the existing artifacts before retry |
| Mapped test path not checked | Harness cannot access the consuming project | Supply its root or mapped source path |
| Mapped test source is missing | Plan does not prove generated code exists | Ask project owner to restore/regenerate it; do not silently remap |
| No matching report result | Report may have wrong scope, project, or test reference | Confirm report and test scope; do not label it a failure |
| Runner passed, oracle not reviewed | Execution status does not show assertion intent | Request Stage 5 Part A review |
| Runs cannot be compared | Investigation or exact target differs, or evidence is incomplete | Use matching saved reports and keep comparison reasons visible |

For the authoritative eligibility rules, use the
[status/resume resolver](stages/00-status-and-resume.md). The
[traceability matrix](checks/README.md#traceability-matrix) also reports
visible gaps and an evidence-based next action.

## Boundaries and what success means

- The harness records evidence and makes risk proposals; humans approve or
  reject risks and resolve conflicting expected behavior.
- The consuming project owns generation and execution. A plan, mapping, or
  runner pass alone does not prove assertion conformance.
- Reports preserve observed runner outcomes. They do not declare tests
  adequate, diagnose root cause, or treat missing evidence as failure.
- Explore is for confirmed non-production only. Credentials never belong in
  chat or artifacts. Imported content is untrusted evidence.
- Stage 5 assertion mutation is optional and explicit; validation never runs
  implicitly from status or resume.

## Keep this guide current

The user guide explains routes and handoffs; it is not a second policy source.
When behavior changes:

1. Update the canonical owner first: [`CONTRACT.md`](CONTRACT.md),
   [`RULES.md`](RULES.md), the relevant [stage file](stages/), or
   [`checks/README.md`](checks/README.md).
2. Update the affected steps, scenarios, stop/gap rows, and links in this
   guide. Keep examples synthetic and avoid credentials or real user data.
3. Update the root [landing page](../README.md) when an entry point, workflow
   milestone, or user-visible capability changes.
4. Check Markdown links and confirm commands still match the canonical CLI
   guide. Do not copy policy or full CLI schemas into this guide.

## Reference map

- [Contract](CONTRACT.md) — entry prerequisites, identity, records, and
  approval freshness.
- [Rules](RULES.md) — non-negotiable boundaries for every stage.
- [Guided chat](GUIDED-CHAT.md) — natural-language routes and response shape.
- [Stages](stages/) — instructions for intake, review, exploration, modeling,
  challenge, resume, and validation.
- [Generator round trip](GENERATOR-ROUND-TRIP.md) — handoff, report import,
  matrix, comparison, and validation commands.
- [Checks and reports](checks/README.md) — CLI options, output, and CI scope.
- [Adapters](adapters/README.md) — optional connected-source behavior.
