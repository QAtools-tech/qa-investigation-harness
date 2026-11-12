# Guided QA chat design

## Goal

A QA engineer can bring evidence into chat, see where they are in the investigation, and pick up the work in a fresh chat using the investigation ID. The assistant recommends a next action and lets the user choose another route when their evidence supports it.

## Approaches

- **Selected: Shared conversational guide.** Use the existing investigation contract to choose an entry point and the shared status and resume resolver to continue. Put the user experience in shared guidance and keep the client instructions short.
- **Deferred: Chat plus a standalone terminal command.** A command could serve scripts and users outside chat. It would also require a programmatic representation of the routing rules and compatibility checks for existing artifacts.

## What the user sees

| User says | What the assistant does |
| --- | --- |
| “Start QA with this checkout case.” | Choose intake and show the proposed ID, source mapping and grouping, and normalized preview. Ask the user to confirm before writing. |
| “Start QA. Here are my recorded observations.” | Use the Model stage if the observations identify one flow and have source locators. Ask for the missing input if they are insufficient. |
| “Review this existing plan.” | Use direct plan review. Link findings to the plan and give one recommended follow-up when there is one. |
| “Help with this failed run.” | Use direct triage. Present the observed failure, possible causes, and the next input that would help distinguish them. |
| “Start QA” with both a plan and a failed run but no stated intent | Offer plan review and failure triage in one short question. A clear request such as “review this plan” takes precedence over other supplied evidence. |
| “Where are we on QA-142?” | Use read-only status. Report the position, blocker if any, and what the user can do next. |
| “Continue QA-142.” | Resolve the position from saved artifacts and supplied evidence. Follow the existing resume rules, then show the resulting position. |
| “Continue” | Use the investigation already established in this chat. If there is no established investigation, ask for its ID. |

If no evidence is supplied at the start, ask for the case, plan, observations, or run the user wants to work from. Direct review and triage can finish in chat under the existing contract. If the user returns in a fresh chat without a saved investigation, ask them to supply the relevant evidence again. A review or triage request by itself does not authorize an intake record.

Use the same short summary after a guided action, including when blocked. Existing stage findings and required previews still appear in full. The summary gives the user a consistent place to find their next action.

> **QA-142 · Ready for risk review**<br>
> **Completed:** Recorded the checkout flow and proposed three risks.<br>
> **Next · You:** Review the three proposed risks in `qa-artifacts/QA-142/risks.md` and record your decisions.<br>
> **Return with:** “Continue QA-142.”

Use the confirmed ID in the heading when one exists. Otherwise, use the route name and show a proposed ID only as part of intake. Give one action with an owner when work can continue. If the requested review is complete and there is no meaningful next action, say it is complete. Keep the existing detailed output for explicit `status` requests.

`QA-142` is an example. Teams can reuse a safe existing ticket ID or confirm a separate local investigation ID under `qa-harness/CONTRACT.md`. Keep the original source reference in the intake record when it differs from the local ID. A supplied plan or spec keeps its original name.

## How it fits the harness

- Use `qa-harness/CONTRACT.md` for minimum evidence and direct entry. Use `qa-harness/stages/00-status-and-resume.md` for saved state, next actions, and allowed chaining. Existing stage files govern writes and other stage behavior.
- Add a shared chat guide for intent, route selection, and the response summary. Start with the existing Codex and Claude Code entry points. Keep direct stage requests available and the guides for each client pointed at the same shared instructions.
- Use existing artifacts for progress and preserve one flow per session. A request about another flow directs the user to start a fresh chat. Ambiguous or conflicting state goes through the existing resolver.
- Keep the intake confirmation, non-production browser prerequisites, human risk decisions, approval freshness checks, and external generator handoff. Guide users to the relevant file or input at each stop. Validation resumes under the existing prerequisites, with assertion mutation remaining opt-in.
- Scope this version to chat guidance and documentation. Standalone commands, Copilot skill packaging, a new state store, and changes to artifact schemas are outside this design.

## Acceptance scenarios

| Scenario | Expected outcome |
| --- | --- |
| New case, no ID or environment | Intake previews a proposed ID and waits for confirmation. Later, if exploration is requested, it asks for the missing environment or access before navigating. |
| Fresh chat, saved case and observations | The user can continue with the saved ID. The resolver reaches the same next action as in the original chat when the evidence is the same. |
| Plan and failed run supplied together | A clear user request chooses the route. When intent is ambiguous, one question resolves it before any stage action. |
| Read-only status at risk review | The user sees the pending decision and where to record it. No artifact is written. |
| Approval became stale or a plan entry is missing its mapping | The assistant names the affected risk or entry and tells the user what must be reviewed or reconciled. It follows the resolver before any export or retry. |
| Fresh export reaches generator handoff | The assistant gives the plan path and identifies the user as the owner of the external handoff. On return, it distinguishes test source that was not checked from source confirmed absent. |
| Direct plan review or failure triage completes | The assistant reports findings and a follow-up when supported by evidence. The flow can end there. |

## Decisions for implementation planning

The shared chat guide and thin Codex and Claude Code instructions are the initial delivery. The detailed plan should identify the exact wrapper files, decide where the shared guide fits in the docs, and specify walkthrough and regression checks for the acceptance scenarios above.
