# Guided QA in chat

Read [RULES.md](RULES.md) and [CONTRACT.md](CONTRACT.md) before acting. Read the
matching stage instructions before running it. Use the contract for evidence
and entry points, and the [status and resume resolver](stages/00-status-and-resume.md)
for saved state and allowed progression.

## Start from the user's request

- **Start:** If the user names a stage or states a clear goal, use that route
  and check its prerequisites. Otherwise, suggest the route supported by the
  evidence. A case goes to intake, locatable observations can go directly to
  Model, a plan can go to direct review, and identifiable failure evidence can
  go to triage. When more than one route fits, ask which outcome the user wants.
  If no evidence was supplied, ask for the case, plan, observations, or run they
  want to work from. The user can change routes within the same flow.
- **Status:** Use the resolver's detailed read-only status format. If the ID
  is missing, use the investigation established in this chat or ask for it.
- **Continue:** Treat “continue QA for <id>” as resume. For a bare “continue,”
  use the ID already established in this chat or ask for it. Resolve progress
  from artifacts and supplied evidence, never from chat history. If a direct
  review or triage had no saved investigation, ask for the relevant evidence
  again when the user returns in a fresh chat. For a different flow, direct
  the user to a new chat.

At intake, show the ID, source mapping and grouping, and normalized preview
before asking the user to confirm the write. Reuse an existing safe ticket ID
when it identifies the investigation. If a separate local ID is needed, propose
it in the preview and keep the original source reference. Direct plan review
uses the plan under its existing name. Connected source reads require an
explicitly selected source and scope and a configured read-only adapter.

If the selected action is blocked, name the missing input or decision and ask
for what would unblock it. Follow the resolver's stops for non-production
browser access, risk review, stale approvals, and generator handoff. At risk
review, tell the human where to record decisions. At handoff, give the plan path
and ask the human to pass it to their project's generator. Resume validation
only when the stage prerequisites are met. Assertion mutation remains opt-in.

## Show the next action

After a guided action, keep the stage's required preview or findings. Add a
short summary with the confirmed investigation ID and position, or the route
name if there is no confirmed ID. Include:

- **Completed** when there is work to report.
- **Next · <owner>** with one concrete action. Name the input, decision, or
  artifact needed when blocked.
- **Return with** when a saved investigation can be resumed by ID.

For example, using an illustrative investigation ID:

> **QA-142 · Ready for risk review**<br>
> **Completed:** Recorded the checkout flow and proposed three risks.<br>
> **Next · You:** Review the three risks in `qa-artifacts/QA-142/risks.md` and record your decisions.<br>
> **Return with:** “Continue QA for QA-142.”

If a direct review or triage is complete and no meaningful follow-up remains,
say it is complete. Explicit status requests use the resolver's detailed
format in place of this summary.
