# Guided QA Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let QA engineers start or continue investigations in chat and see one clear next action at each stage.

**Architecture:** Add a shared conversational guide that delegates evidence routing to the investigation contract and state resolution to the existing status and resume instructions. Point Codex and Claude Code at that guide and document the interaction with reusable rehearsal cases.

**Tech Stack:** Markdown instructions and walkthroughs, existing Codex and Claude Code adapters, existing Node.js checks.

**Spec:** [Guided QA chat design](../specs/2026-11-12-guided-qa-chat-design.md)

## Global Constraints

- Use `qa-harness/CONTRACT.md` for minimum evidence and direct entry. Use `qa-harness/stages/00-status-and-resume.md` for saved state, next actions, and allowed chaining. Existing stage files govern writes and other stage behavior.
- Use existing artifacts for progress and preserve one flow per session.
- Keep the intake confirmation, non-production browser prerequisites, human risk decisions, approval freshness checks, and external generator handoff.
- Keep assertion mutation opt-in and Playwright test generation with the consuming project's generator.
- Scope this version to chat guidance and documentation. Standalone commands, Copilot skill packaging, a new state store, and changes to artifact schemas are outside this design.
- Preserve the existing identity contract and the team's original ticket and spec references. Example IDs are illustrative.

## File Map

| File | Responsibility |
| --- | --- |
| `qa-harness/GUIDED-CHAT.md` | Shared chat intent, delegation, and reply shape |
| `AGENTS.md`, `CLAUDE.md` | Plain-language discovery and pointer to shared guidance |
| `.agents/skills/qa-status-resume/SKILL.md`, `.claude/skills/qa/SKILL.md` | Shared reply guidance for existing explicit shortcuts, with their inputs preserved |
| `README.md`, `qa-harness/README.md` | Chat-first quick start and client-specific access |
| `qa-harness/walkthroughs/guided-chat.md` | Copyable examples and release rehearsal expectations |

## Review Focus

- A plan and failed run arrive together with no stated goal. Ask one question before selecting a stage. Covered by Task 1's ambiguous entry rehearsal and Task 3's walkthrough.
- A bare “continue” arrives in a fresh chat, or a different ID is requested in an active flow. Ask for the ID or direct the user to a fresh chat, respectively. Covered by Task 2's client rehearsal.
- A source ticket contains `/`, or a plan name follows a team-specific convention. Keep the source reference, confirm a safe local ID if intake needs one, and leave the plan name as supplied. Covered by Task 1's intake and plan-review rehearsals.
- A plan entry already exists without its mapping, or an approval refers to an earlier source revision. Surface the exact blocker and preserve existing entries. Covered by Task 3's handoff and stale approval scenarios.
- A direct review has no saved investigation, or generator output lives in a root the user hasn't supplied. Request evidence again in a fresh chat, or report output as unchecked, respectively. Covered by Task 3's resume and handoff scenarios.

### Task 1: Define the shared chat workflow

**Files:** Create `qa-harness/GUIDED-CHAT.md`.

**Interface:** Consumes the user's request, supplied evidence and locators, the current chat's established investigation ID when available, and the existing resolver's findings. Produces a delegation to an existing route or one clarifying question, plus a short user-facing summary after the route reports its results.

- [ ] **Write the rehearsal expectations before editing.** For “Start QA with this case from `Payments/142`” with no safe local ID, expect intake preview with the original reference, a proposed safe ID and a confirmation request before any write. For “Review this plan” with `Checkout regression v2.md`, expect direct review under its existing name. For “Start QA” with both a plan and a failed run, expect one question about review versus triage. For “Review this plan” with the same inputs, expect direct plan review without the question.
- [ ] **Add the shared guide.** Define start, status and continue as chat intents. Explicit stage requests take priority. For a clear start, check `CONTRACT.md`, delegate to the relevant stage, and enforce that stage's prerequisites. Ask for one missing input when no route can proceed. Require explicit scope and the configured adapter for provider reads. For status and continue, delegate to the resolver. Use chat context only to identify an already established ID, never to infer progress.
- [ ] **Define the reply shape in the guide.** Use a heading with the confirmed ID and position, or the route name before an ID is confirmed. Use `Completed` when there is completed work, `Next · <owner>` with one action when further work is possible, and `Return with` when the saved ID can be used to resume. Name the specific blocker or missing input in the next action. Include the stage's full preview or findings where required. Explicit status retains the resolver's detailed format. For a finished direct review or triage with no meaningful follow-up, say it is complete.
- [ ] **Review against the rehearsal expectations.** Trace each request through the guide and existing stage or contract. Check that the guide does not contain a second state table or a second rule for artifact writes. Run `git diff --check` before committing the guide with `docs(qa): define guided chat workflow`.

### Task 2: Connect the existing chat entry points

**Files:** Modify `AGENTS.md`, `CLAUDE.md`, `.agents/skills/qa-status-resume/SKILL.md`, and `.claude/skills/qa/SKILL.md`.

**Interface:** Consumes `qa-harness/GUIDED-CHAT.md` from Task 1. Exposes plain-language start, status and continue in both clients. Existing status/resume shortcuts keep their arguments and route to the same resolver.

- [ ] **Write the client rehearsal expectations before editing.** In each client, check that a plain-language case start routes to intake, that `continue QA-142` loads the resolver, that bare “continue” without an established ID asks for it, and that a request to switch from an active `QA-142` flow to `PAY-77` directs the user to a new chat. Existing explicit status commands must use the detailed read-only output.
- [ ] **Update the root instructions.** Near the top of `AGENTS.md` and `CLAUDE.md`, show “Start QA with this case” and “Continue QA for <investigation-id>” and point to `qa-harness/GUIDED-CHAT.md`. Keep the existing direct-stage lists and source/MCP setup guidance. Adjust nearby copy that suggests users must know a stage before starting.
- [ ] **Update the existing shortcuts.** In the Codex status/resume skill and Claude Code `/qa` skill, link the shared guide for the guided resume summary. Keep the rules, contract, resolver, explicit status output, and existing Claude Code frontmatter and argument handling.
- [ ] **Check the client wiring.** Verify all four entry files point to the shared guide and the original resolver references still resolve. Rehearse the client prompts in fresh sessions where the clients are available, using synthetic evidence. Record which clients were actually exercised. Run `git diff --check` before committing the four files with `docs(qa): connect guided chat entry points`.

### Task 3: Publish the quick start and rehearse the stops

**Files:** Modify `README.md` and `qa-harness/README.md`. Create `qa-harness/walkthroughs/guided-chat.md`.

**Interface:** Consumes the shared guide from Task 1 and the two chat entry points from Task 2. Gives users copyable starting prompts and gives maintainers a set of expected results to rehearse after guidance changes.

- [ ] **Write the walkthrough and its expected results.** Include new-case preview and missing environment, direct plan review and failed-run triage, both supplied together, fresh-chat resume, read-only status, stale approval, interrupted mapping, and a fresh approved handoff. Include a bare continue after a chat-only review and an unchecked external test root. For every example, give the user message, artifact or evidence setup, expected route, and next action or completed result. Use synthetic examples and existing walkthrough fixtures where available. State what each rehearsal can verify.
- [ ] **Update the public entry instructions.** Add the chat-first examples before the detailed routing choices in `README.md` and in the Codex and Claude Code sections of `qa-harness/README.md`. Link the walkthrough. Explain that ticket formats vary and existing specs keep their names. Keep detailed setup discoverable and describe guided chat only for the two initial clients.
- [ ] **Rehearse the acceptance scenarios.** Use a disposable synthetic workspace. At read-only status, compare the relevant artifact contents before and after. At stale approval and interrupted mapping, verify existing plan and decision records are preserved. At generator handoff, check that the assistant identifies the plan path and asks the user to run the consuming project's generator. In a fresh chat, verify saved state is enough to select the same next action. Record observed results and label any client or route that could not be exercised.
- [ ] **Run existing repository checks.** Run `node --test qa-harness/checks/*.test.mjs qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs` from the repository root, using shell-expanded filenames if the shell requires it. Expect zero failures. Run `git diff --check` and open each new relative Markdown link. Commit the quick start and walkthrough with `docs(qa): document and rehearse guided chat`.
