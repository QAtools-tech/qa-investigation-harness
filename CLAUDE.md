# QA Investigation Harness

Repo has risk-driven QA investigation harness. Full rules in
[qa-harness/RULES.md](qa-harness/RULES.md) — read before running any stage
below, follow exactly.

## Guided QA in chat

Ask “Start QA with this case” and supply the case or other evidence, or say
“Continue QA for <investigation-id>” to pick up saved work. For guided
requests, including direct review and triage from supplied evidence, read
[the guided chat instructions](qa-harness/GUIDED-CHAT.md). Use the contract
and shared resolver they reference.

Use `/qa status <investigation-id>` for read-only progress report, or
`/qa resume <investigation-id>` to continue from next eligible action.
Both use `qa-harness/stages/00-status-and-resume.md`; status never writes,
resume preserves human approval + generator handoff stops.

Never write Playwright test code yourself. Test generation belongs to
project's test-generation agent (see qa-harness/RULES.md to get one
if none exists) — harness only investigates, produces
human-reviewed test plan, audits result.

## Direct stages

Invoke as skills, in order:

- `/qa-intake` — preview and import local cases, plans, or evidence after confirmation
- `/qa-review-plan` — read-only review of a supplied plan or spec
- `/qa-explore` — walk flow, record observations (Stage 1)
- `/qa-model` — build state/transition model (Stage 2)
- `/qa-challenge` — risk table, then (after human approval) test plan (Stage 3)
- `/qa-validate` — audit generated tests against approved risks (Stage 5)

Focused read-only agents are available for risk and validation review:
`qa-risk-challenger` and `qa-validation-reviewer`. The parent workflow
reconciles their cited findings; human approval remains required.

Stage 4 — generating tests — not a skill here. Point
project's test-generation agent at `specs/<ticket>.plan.md` file Stage 3
produces, same as handing it any other plan.

See [qa-harness/README.md](qa-harness/README.md) for full walkthrough.
