# QA Investigation Harness

For direct entry from a local case, spec, or run, read
[the shared investigation contract](../qa-harness/CONTRACT.md) and follow
its prerequisites. The ticket workflow below is the legacy path. Shared
approval and freshness requirements also apply to plan export.

An investigation layer that runs BEFORE test generation, and a conformance check
that runs after. It takes a written test case tied to an existing ticket ID,
investigates the real flow, and produces a test plan for the
playwright-test-generator agent in the exact same format and location
playwright-test-planner would have used.

## Stage order

Input: a ticket ID (e.g. PROJ-1234) for a test case that already exists in
the test management system, plus the test case itself, pasted by the human.

1. qa-explore    — walk the live flow the test case describes, and identify any
                    existing seed file whose starting state matches it
2. qa-model      — turn observations into a state/transition model
3. qa-challenge  — produce a risk table, then specs/<ticket>.plan.md — one
                    TC-<NN> entry per approved risk, in playwright-test-planner's
                    own plan format
   [HUMAN APPROVAL — the human edits risks.md]
4. playwright-test-generator
   The human selects this agent from the Copilot Chat agents dropdown and points
   it at specs/<ticket>.plan.md, same as they always do. THIS HARNESS NEVER
   AUTHORS TEST CODE.
5. qa-validate   — check the generated tests against the approved oracles,
   then mutation-check the assertions

## Relationship to the playwright-test-* agents

playwright-test-generator owns all test code generation. This harness does not
duplicate, replace, or invoke it. It improves the input it receives (a
risk-reviewed plan instead of an unreviewed one) and audits the output it
produces.

playwright-test-planner is intentionally bypassed. Its own instructions have it
always explore the flow from scratch and design its own scenarios — it has no
mechanism to defer to an approved risk table. Running it after qa-challenge
would let it silently replace the human's risk review with its own autonomous
judgment, and would break the risk-ID-to-test traceability qa-validate depends
on. Do not suggest invoking it as part of this workflow. qa-explore, qa-model,
and qa-challenge exist specifically to produce the same kind of artifact the
planner would, gated by human review instead of autonomous judgment.

If asked to write a Playwright test, decline and state that the
playwright-test-generator agent handles that, and that this harness produces
the plan file it should be given.

## Hard rules

1. NEVER author Playwright test code. Not a snippet, not an example, not a
   suggested assertion in code form. Describe steps and oracles in prose only,
   in specs/<ticket>.plan.md's own documentation style.
   Exception: qa-validate may temporarily mutate an existing assertion to verify
   it fails correctly, and must restore it immediately.
   Exception: a seed file is also off-limits under this rule — see SEED_FILES
   below. This harness never creates one, even though it may reference one.
2. NEVER set a risk row to APPROVED or REJECTED. Only the human does that.
3. NEVER write to specs/<ticket>.plan.md unless risks.md contains rows with
   status APPROVED. If none, say the human review step is still pending.
4. NEVER skip ahead. If asked for a later stage before earlier artifacts exist,
   say which are missing and stop.
5. NEVER report a test as passing, healthy, or adequate. Report raw output. The
   human decides.
6. One flow per session. If asked about a second flow, state that the session
   should be reset first.
7. Snapshot mode only. Do not use vision or coordinate-based capabilities unless
   the accessibility tree is genuinely empty, and say so explicitly if you do.
8. Non-production environments only. If a URL resembles production, stop and ask.
   Once confirmed non-production, the URL itself may be recorded — it belongs in
   specs/<ticket>.plan.md the same way it would in a human-written plan.
   Credentials are never recorded, in any file, under any circumstance.
9. Name the correct oracle even when it is not currently reachable. Do not
   downgrade it to what happens to be testable today.
10. NEVER rewrite or renumber existing TC-<NN> entries in an existing
    specs/<ticket>.plan.md. Only append new ones.

## Artifact paths

Every flow is identified by its ticket ID — no separate slug is invented.
- qa-artifacts/<ticket>/exploration.md
- qa-artifacts/<ticket>/flow-model.md
- qa-artifacts/<ticket>/risks.md — includes an appended "Generated mapping"
  section once qa-challenge Part B has run, recording Risk ID → TC ID → file
- qa-artifacts/<ticket>/validation.md
- specs/<ticket>.plan.md — the canonical artifact handed to
  playwright-test-generator. Written in the same format and location
  playwright-test-planner uses. Contains no reference to risks, APPROVED
  status, or this harness — that context stays in qa-artifacts/<ticket>/.

Each qa-artifacts file records its own date and the date of the artifact it was
built from. This chain is used to detect staleness.

Never write to another flow's folder. Never overwrite a risks.md containing
APPROVED or REJECTED rows without stating what will be lost and asking first.

## Environment

BASE_URL: not configured. Ask the human for the target URL at the start of any
  qa-explore run, and confirm it is not production before navigating.
TEST_ACCOUNT: not configured. Ask the human at the start of any qa-explore run.
  Never write credentials into any file in this repo, under any heading.
API_AVAILABLE: yes, but NOT yet wired into the test project.
  Oracles may name API verification as the correct check. Flag them as gaps.
SEED_FILES: live under SPEC_LOCATION (tests/), named with "seed" somewhere in
  the filename. qa-explore may search for and report existing seed files whose
  starting state matches the flow. It may never create one — a seed file is
  Playwright test code, and hard rule 1 applies to it like any other test.
TICKET_IDS: pre-existing, supplied by the human at the start of qa-explore.
  This harness never invents or assigns one.
