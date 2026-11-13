# Guided QA journey design

## Intent

Help a QA engineer quickly understand where a guided action left an investigation, what is blocking it, and what to do next. The shared resolver already determines saved progress; this change makes its result easier to scan in conversational replies.

## Goals

- Use a consistent short wrap-up after guided actions, whether the action advances, blocks, or completes an investigation.
- State the current position and completed work when known.
- When blocked, name the decision or input needed and distinguish missing evidence from evidence that was not checked.
- Give one concrete next action with its owner, plus an exact resume prompt when saved work can continue by ID.
- Add walkthrough cases for a human-review stop, an unchecked external test path, generator handoff, and a completed direct review.

## Non-goals

- Add a CLI, state store, new artifact fields, or another progress resolver.
- Change stage eligibility, artifact writes, human approval, validation, or generator boundaries.
- Repeat the detailed status report after every action or force empty fields into replies.

## Constraints

- `qa-harness/stages/00-status-and-resume.md` remains authoritative for saved progress and blockers.
- `qa-harness/GUIDED-CHAT.md` owns the shared conversational response guidance; stage files retain their required previews and findings.
- Keep the guide concise: show only fields with useful evidence, and never infer an external path was checked when its project root was not supplied.

## Approaches

1. **Selected: Tighten the shared chat guide and its walkthrough.** Add a small response contract and representative blocked, handoff, and complete examples. This reuses the current resolver and keeps the harness documentation-first.
2. **Add a deterministic status command.** It could print the same summary outside chat, but would duplicate routing, approval-freshness, and evidence rules that already live in the resolver.

## Proposed behavior

After a guided action, provide a compact summary with the investigation ID and position (or the route name before an ID is confirmed). Include completed work when useful. If blocked, name the blocker and the exact missing input or decision; say “not checked” when an external path was not supplied. Give one next action and owner. Include a return prompt only when an investigation ID can resume saved work. If the route is complete and no useful action remains, say so plainly. Explicit status requests keep the resolver's detailed read-only format.

The walkthrough will let maintainers compare these expected fields with the assistant's response using synthetic evidence. It will not claim to test every client or stage unless that client or stage is actually exercised.

## Acceptance scenarios

| Scenario | Expected outcome |
|---|---|
| Proposed risks await human review | Position is risk review; blocker names the decision and `risks.md`; next action belongs to the human; resume prompt uses the confirmed ID. |
| Approved plan exists but consuming-project root was not supplied | Position identifies generator handoff or pending output check; the path is “not checked,” not “missing”; next action asks for the project root or generator action as appropriate. |
| Generator handoff is ready | Summary names the plan and the human-owned generator action, without implying tests exist. |
| Direct plan review has no meaningful follow-up | Findings remain visible and the response says the review is complete without an invented next step. |

## Approval boundary

This design changes shared chat guidance and its walkthrough only. Implementation starts after human approval.
