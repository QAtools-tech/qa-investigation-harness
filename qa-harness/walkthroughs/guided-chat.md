# Walkthrough: Start and continue QA in chat

Open a disposable checkout in Codex, Claude Code, or VS Code with the
Copilot harness. Use a fresh chat for each independent flow. In VS Code, open
the checkout root and check that the session discovers
[the repository's Copilot instructions](../../.github/copilot-instructions.md).
Keep rehearsal artifacts in the disposable checkout
and compare the relevant files before and after each read-only or blocked
action. These examples use synthetic evidence. They exercise routing and
stop conditions without needing a live application or a test generator.

## Start with a case

Provide [the sample CSV](../fixtures/walkthroughs/csv-case/cases.csv) and say:

> Start QA with row 2 of this case file. Its source ticket is Payments/142.

Expect an intake preview with the source row, missing expected result, and a
proposed safe local ID. The original ticket reference should remain visible.
There should be no intake file before you confirm the ID, source mapping and
grouping, and preview.

Follow [the CSV walkthrough](csv-case-to-approved-handoff.md) to supply the
expected result and confirm intake. Then ask to explore this flow without
giving a target or access. Expect a request for the non-production environment
and interactive access before navigation.

## Continue from saved work

Use the CSV walkthrough's
[recorded observations](../fixtures/walkthroughs/csv-case/recorded-observations.md)
to model the flow and reach proposed risk review. Save the files in the
disposable checkout as the relevant stages produce them. Open a fresh chat
in that checkout and say:

> Continue QA for CASE-701.

Replace CASE-701 throughout this walkthrough if you confirmed a different ID.
Expect the same risk-review stop from the saved artifacts. The next action should
point you to `risks.md` to record your decisions. Ask “Status for CASE-701”
in another fresh chat. Expect the resolver's detailed read-only output.
Compare the saved artifacts before and after both requests at this stop.
Neither request supplies human approval.

In a separate fresh chat, say only “Continue QA.” Expect a request for the
investigation ID. If your previous activity was a chat-only review, supply
its plan or other evidence again.

## Review a plan or triage a failed run

Use the [filter plan](../fixtures/filter-plan.md) and
[failed-run evidence](../fixtures/walkthroughs/spec-failed-run/run-evidence.md).
Try each request in a separate chat:

| Say | Expect |
| --- | --- |
| “Review this plan.” Supply both files. | Direct plan review. The response cites the plan, keeps its name and contents, and gives a follow-up if useful. |
| “Help with this failed run.” Supply the run evidence. | Direct triage. The observed failure is separate from possible causes, with one next input when further diagnosis needs it. |
| “Start QA.” Supply both files. | One question about plan review or failure triage before running a stage. |

Compare the plan before and after the review. Check that the direct requests
did not create intake records or imply approval.

## Rehearse stale approval and handoff

1. **Stale decision.** Copy [the CASE-404 flow model](../fixtures/reviewers/stale-approval/flow-model.md)
   and [risk table](../fixtures/reviewers/stale-approval/risks.md) to
   `qa-artifacts/CASE-404/` in the disposable checkout. Copy
   [its existing plan](../fixtures/reviewers/stale-approval/specs/CASE-404.plan.md)
   to `specs/CASE-404.plan.md`. In a fresh chat, say “Continue QA for CASE-404.”
   Expect R1 and its changed flow-model revision to be named. Compare the
   plan and risk table before and after. The old decision and plan entry
   should be intact.
2. **Approved handoff.** In the separate CSV case, review the risk grounded in
   the recorded Open filter steps and record your decision, following
   [Challenge Part B's prerequisites](../stages/03-challenge.md). When the
   decision matches the current risk, oracle, and dependencies, say
   “Continue QA for CASE-701.” Expect the exported plan path and the next
   action for you to prepare the handoff to the consuming project's generator.
   If no existing seed was found, the plan must identify that prerequisite. If the
   test root was never supplied, expect the output to be described as
   unchecked. Supply a known-empty consuming-project root if you also want
   to check the distinction between unchecked and confirmed absent.
3. **Interrupted mapping.** Duplicate the approved-handoff checkout. In the
   copy, keep the plan entry and decision but manually remove the
   corresponding generated mapping section. In a fresh chat, say
   “Continue QA for CASE-701.” Expect a request to confirm the existing TC
   entry. Compare plan contents before and after to confirm the assistant
   did not add a second entry.

Record the client, prompt, first selected route, next action, and observed
file changes for each rehearsal. Record unexercised routes separately.

## Rehearse progress summaries

Use synthetic evidence in a disposable checkout. Preserve each stage's full
findings. Compare post-action summaries with these expectations; an explicit
status request must use the resolver's detailed read-only format instead.

| Scenario and setup | Prompt | Expected response |
|---|---|---|
| CASE-701 has proposed risks awaiting human decisions in `qa-artifacts/CASE-701/risks.md`. | “Continue QA for CASE-701.” | Position identifies pending risk review. Blocking names the human decision and `risks.md`. Next action belongs to the human and tells them to record decisions. Return prompt uses CASE-701. |
| CASE-701 has a fresh approved plan and mapping, but no consuming-project root was supplied. | “Status for CASE-701.” | Use the detailed status format. Missing test-source evidence is marked “not checked,” not absent, and next action asks for the consuming-project root or mapped source path. |
| CASE-701 has a fresh approved plan and mapping, and test generation has not yet been confirmed. | “Prepare the Playwright generator handoff for CASE-701.” | Position identifies the handoff. Summary names the plan path and the human-owned generator action; it does not imply generated tests exist. |
| The user supplies a plan with clear steps and expected results, no conflicting claims, and no unresolved review findings. | “Review this plan.” | Findings remain visible and the route is identified as complete. Do not invent a next action, investigation ID, or return prompt. |

These are guidance rehearsals, not proof that every client produces identical
responses. Record the client and actual output when a client is exercised.
