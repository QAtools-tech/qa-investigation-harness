# Status and resume

Read `qa-harness/RULES.md` and `qa-harness/CONTRACT.md` before resolving an
investigation. This file is the shared state resolver for `status` and
`resume`; stage files remain the source of stage behavior.

Input: `status <investigation-id>` or `resume <investigation-id>`. Use one
investigation per session, including when resuming from a new chat.

## Resolve identity and evidence

1. Validate the ID against `CONTRACT.md` before building a path. Reject
   separators, unsafe names, reserved device names, case-insensitive
   collisions, paths outside the intended directory, and directories that
   cannot be confirmed as belonging to this investigation. Do not create,
   rename, or repair anything during status.
2. Inspect only `qa-artifacts/<id>/` and `specs/<id>.plan.md`, plus mapped
   source/test paths when the user identifies the consuming project location.
   Resolve relative mappings under that project root and reject paths that
   escape it; do not follow arbitrary absolute paths from artifact text.
   Do not infer progress from chat history, timestamps alone, or a plan file
   alone.
3. Read each present artifact needed to determine its contents and
   dependencies. Current parseable v1 decisions and their reviewed text take
   precedence over legacy status labels. When no v1 decision records exist,
   use the legacy source-date chain. Dates indicate ordering; they do not
   prove approval. If records disagree, dates are ambiguous, a required file
   is malformed or empty, or the investigation identity is uncertain, report
   the exact file/record and stop the affected action. Never guess.
4. For approval, compare each decision with the current risk text, oracle, and
   linked dependency revisions. Name each stale risk and the changed or
   missing dependency. Keep unaffected decisions visible. If dependency links
   are absent, request review of the affected scope. An imported `APPROVED`
   label is a source claim, not a human decision by this harness.
5. If there are multiple generated mapping sections, use the latest clearly
   dated section. If dates tie, conflict, or cannot be parsed, stop and name
   the mapping sections that need review. A plan without a matching mapping
   does not establish an approved handoff. A plan and mapping do not establish
   that a generator produced tests.

## Resolve the next action

Use the first applicable row. For direct entry, follow the minimum evidence
and stop conditions in `CONTRACT.md`; do not force users through earlier
stages when their evidence supports review or triage directly.

| Evidence on disk or supplied now | Current position and next action |
|---|---|
| No usable case, spec, or run evidence | Intake is blocked. Request a case, spec, or evidence excerpt with a locator. A new investigation also needs a local ID before any write. |
| Case supplied, no matching investigation record | Run `stages/intake.md` to preview and confirm the source first; then Explore if live-path prerequisites are available. |
| `investigation.md` contains case/requirement evidence, no exploration | Explore if the user requests live-path investigation and supplies the required environment/access. If the evidence is an existing spec, use direct plan review. |
| `investigation.md` contains identifiable run/failure evidence, no exploration or validation | Triage failures directly, or use direct validation when requested and expected behavior is available. Name missing test source or expected behavior; do not infer assertion intent from a run result. |
| Spec supplied without harness artifacts | Run `stages/review-plan.md` directly. If the user requests conformance validation, also request test source or run evidence as required by the contract. |
| Identifiable failure/run evidence without harness artifacts | Triage directly. Report the observed failure and possible causes separately; ask for missing context that would narrow them. |
| `exploration.md` exists, `flow-model.md` does not | Model from the observations and cite their locators. |
| `flow-model.md` exists, `risks.md` does not | Challenge Part A from the model and source observations; propose risks only. |
| `risks.md` has `PROPOSED` rows but no `APPROVED` rows | Stop for human review. Name proposed/rejected counts and ask the human to decide the proposed rows. Do not export. |
| All valid risk rows are `REJECTED` | Report that review is complete with no exportable risks. Ask the human whether to revise the risks or close the investigation. |
| Current `APPROVED` rows exist, but any required approval/dependency is stale or missing | Stop export for affected risks. Name the stale approval and the exact review/update needed. Preserve prior decisions and plan entries. |
| A fresh approved risk appears in an existing plan but has no mapping | Report a possible interrupted export. Do not create another TC entry. Ask the human to identify and confirm the existing entry; then Stage 3B may add only the missing mapping if its content matches. |
| A generated mapping points to a missing plan entry | Stop and identify the risk, TC ID, and missing plan location. Ask the human to reconcile the artifacts before resuming. |
| Fresh approved risk has no plan mapping, or a safe retry is needed | Challenge Part B may proceed only after checking the existing plan and mappings under `03-challenge.md`. If plan/mapping disagree or an existing entry is not safely attributable, stop and report it. |
| `validation.md` predates or does not cover the current mapping, and mapped test source is accessible | Report the exact newer mapping and run Stage 5 Part A for it. |
| `validation.md` predates or does not cover the current mapping, but mapped test source was not checked | Report the stale validation and request the consuming-project root or mapped source path before routing to Stage 5. |
| `validation.md` predates or does not cover the current mapping, and mapped test source is confirmed absent | Report the stale validation and ask the human to restore or regenerate the mapped source before Stage 5. |
| `validation.md` covers the current mapping and no newer evidence exists | Report the recorded findings as complete for this mapping. Stage 5 Part B remains opt-in and must never run implicitly. |
| A current generated mapping and plan exist, but the mapped test path was not checked | Report that generator output is unconfirmed and request the consuming-project root or mapped path. |
| A current generated mapping and plan exist, and mapped test files are confirmed absent | Generator handoff. Tell the human to point the consuming project's generator at the plan. Do not claim tests exist. |
| Mapping and plan exist; mapped test source is available | Run the approved-risk audit in `05-validate.md`. If generated files live elsewhere and their location is unknown, request that location first. |
| Only a plan and run evidence are available | Use direct validation or triage per `CONTRACT.md`. Do not claim approved-risk conformance without decisions, mapping, and test source. |

An `APPROVED` row beside a `PROPOSED` row does not approve the latter. Resume
may export only current approved revisions that are not already mapped, and
must obey the append-only TC rules. A rejected-only review has no exportable
risks; report that state and wait for the human's next decision.

## Status action (read-only)

Report in this shape, omitting a field only when it truly has no value:

```markdown
## QA status: <investigation-id>
- Position: <stage, handoff, blocked, or complete>
- Completed: <artifact/stage evidence found>
- Blocking: <decision, stale dependency, malformed file, or none>
- Missing evidence: <named file/input or none>
- Next action: <one concrete action and owner, or none if complete>
- Resume with: `resume <investigation-id>` or the exact direct-stage request
```

Status may read relevant artifact contents and, when a consuming-project root
is supplied, inspect mapped-path existence. It must not create, edit, repair,
approve, reject, export, validate, or run tests. Distinguish
"not found" from "not checked" when an external consuming-project path was
not supplied. Never report tests as passing, healthy, or adequate.

## Resume action

Use the same resolver and blockers as Status, then follow the named existing
stage file exactly. Resume may chain Explore → Model → Challenge Part A once
the user has supplied all Explore prerequisites. It must stop for human risk
review, before any Part B without fresh approval, and at the external
generator handoff. Never auto-run Stage 5 Part B. If a direct review or triage
entry is selected, use the contract's prerequisites and preserve its separate
reporting rules. After work, report the same status shape with the resulting
artifacts and next action.

## Resolution examples

| Scenario | Status result | Resume behavior |
|---|---|---|
| `risks.md` contains only `PROPOSED` rows | Challenge review pending; `risks.md` is the blocker; human must decide each row | Stop. Do not change statuses or write `specs/<id>.plan.md`. |
| Risk was approved, then its expected result or linked source revision changed | Approval is stale for the named risk; identify the changed dependency and request human review | Stop export for that risk and retain the old decision/TC. |
| Fresh approved risks are mapped in the plan and mapped test files are not present | Ready for generator handoff; report that test generation is unconfirmed | Stop and direct the human to the consuming project's generator. If the external path was not supplied, say it was not checked. |

Malformed or contradictory evidence takes precedence over all ordinary
progress rows: report the precise issue and stop the action that depends on it.
