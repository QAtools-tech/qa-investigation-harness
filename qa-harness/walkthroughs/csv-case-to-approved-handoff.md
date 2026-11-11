# Walkthrough: CSV case to an approved handoff

This is an offline, synthetic walkthrough. It checks intake, evidence routing,
and the approval boundary. It does not exercise a real browser or generate
Playwright code. The observations are explicitly labeled synthetic.

## Prepare a fresh chat

Start a new chat with the repository open. Give it the public
[`AGENTS.md`](../../AGENTS.md), then say:

> I have a local CSV case. Follow the QA harness intake instructions. Preview
> only; do not create or change files until I confirm the exact ID, row, and
> field mapping. Use `qa-harness/fixtures/walkthroughs/csv-case/cases.csv`,
> select row 2, and propose the local ID `CASE-701`.

The correct entry point is **Intake**. The preview should identify the source
row and the blank `expected_result`; it must ask for the expected behavior and
must not infer one from the case title or steps. It should not select Explore
yet or write `qa-artifacts/CASE-701/investigation.md`.

Reply with the missing source information:

> The case owner clarifies: only tasks labeled Open should appear; the known
> Closed task should be hidden. Keep the fixture row as the source and record
> this as a user clarification. Show me the updated preview; do not write yet.

Review the updated preview. Confirm it only when the ID, source row, mapping,
and clarification are correct. For this scripted synthetic walkthrough, the
following explicit confirmation is part of the example; give it only after
the updated preview matches those details:

> I confirm ID `CASE-701`, CSV row 2, the displayed field mapping and grouping,
> and the clarified Open-only expected behavior. Write the intake record.

This confirmation permits writing the intake record only; it is not risk
approval. In a real chat, wait for the actual user's confirmation instead.

## Continue from supplied observations

No non-production application or credentials are included. Do not start
Explore or claim a browser exploration occurred. The contract allows direct
Model from supplied observations, so ask the model to use
[`recorded-observations.md`](../fixtures/walkthroughs/csv-case/recorded-observations.md)
as imported synthetic evidence, cite its O1/O2 locators in the flow model,
and leave reload behavior unknown. Then ask for the risk challenge Part A.

The challenge should produce only `PROPOSED` risks and stop for human review.
Ask `status CASE-701`, then `resume CASE-701`; both should name human risk
review as the blocker. If you request Part B or a generator plan now, it must
not create `specs/CASE-701.plan.md`. Missing approval must be named explicitly.

## Check stale approval in a new chat

Use a clean copy of
[`stale-approval/`](../fixtures/walkthroughs/csv-case/stale-approval/) as the
working project root, then start another new chat and say:

> Resume investigation `CASE-701` from the supplied artifacts. Inspect the
> current requirement and the recorded human decision. Do not edit, approve,
> repair, or export anything.

The current requirement includes Blocked tasks, while decision D1 reviewed the
older Open-only oracle and revision 1. The harness must name R1 as stale, cite
the changed requirement/oracle, and ask the human to review it. It must leave
D1 intact and stop before writing a plan or changing a mapping.

## Handoff condition

Only a human can approve the current risk and oracle. Once the human has
reviewed the current evidence, explicitly recorded a fresh decision, and
resolved any stale dependencies, a later `resume CASE-701` may follow Stage 3B.
The generator handoff remains external; this walkthrough does not create test
code. If no human decision was supplied, stop at the review boundary.

## First-run record

Record the first selected entry point, each named missing input, whether the
agent waited for preview confirmation, and whether it stopped with missing or
stale approval. Keep the agent's first response separate from any correction
or follow-up prompt. Synthetic observations are not live verification.
