# Read-Only QA Status and Resume Implementation Plan

> **For agentic workers:** Run this plan in order. QA test code still owned by consuming project's generator.

**Goal:** User see investigation state, safely resume next eligible stage, using only repo artifacts.

**Architecture:** `qa-harness/stages/00-status-and-resume.md` is shared resolver, source of truth for behavior. `status` report state, no write. `resume` use same resolver, follow existing stage instructions only when prereqs met. Thin Claude, Copilot, Codex entry points expose both actions.

**Tech Stack:** Markdown instructions + existing client adapter formats. No runtime, no network dep.

**Spec:** `docs/superpowers/plans/2026-11-11-public-qa-harness-evolution.md` Phase 2 + Phase 2 direction from conversation.

## Global Constraints

- Status stay read-only, infer progress from artifacts on disk.
- Human risk approval + external generator handoff stay mandatory stops.
- Never assume plan proves generated tests exist.
- Keep direct stage entry points + all Phase 1 contract rules.
- No runtime, package, CI workflow, or Playwright test code added.

## Review Focus

- Pending approval must name `risks.md`, ask human decision; resume must not export plan.
- Stale approval must name affected risk + changed dependency; resume must stop before export.
- Plan + mapping without reachable generated test evidence must not be called generated or validated.
- Partly-written plan/mapping pair must be spotted; retry must not duplicate or renumber TC entry.
- Malformed/conflicting artifacts must give named blocker + repair/review action, never guessed state.
- New investigation, no artifacts: route by supplied case/spec/run evidence under `CONTRACT.md`.

---

### Task 1: Define the shared status and resume resolver

**Files:**
- Create: `qa-harness/stages/00-status-and-resume.md`
- Modify: `qa-harness/RULES.md`

**Interfaces:**
- Consumes: `CONTRACT.md`, four existing stage files, artifact chain in `docs/architecture.md`.
- Produces: read-only `status` report + `resume` action dispatching to existing stage file.

- [x] Define safe investigation-ID/path resolution, one-flow-per-session rule, supported artifact discovery set.
- [x] Define metadata precedence: current parseable artifact contents + v1 decisions rule; legacy status rows use legacy date chain; disagreement, bad data, or fuzzy dates block progress with exact locations.
- [x] Define state resolution for intake/direct review, explore, model, challenge Part A, pending/rejected approval, eligible or stale Part B, generator handoff, validation, triage, malformed/partial artifacts.
- [x] Define safe partial-export recovery: never duplicate unmatched plan entry, need human attribution before adding missing mapping only, stop if mapping targets absent TC entry.
- [x] Define fixed report shape: current position, done artifacts, blockers, missing evidence, next action, exact resume request.
- [x] State status never writes; resume never marks decisions, never exports without fresh human approval, never runs mutation checks quietly, never guesses generator output from plan.
- [x] Add pending-approval, stale-approval, plan-ready-for-generator examples to stage file.

### Task 2: Wire thin client entry points

**Files:**
- Create: `.claude/skills/qa/SKILL.md`
- Create: `.github/prompts/qa.prompt.md`
- Modify: existing four Claude skills + four Copilot prompts, forward to shared stage files
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `qa-harness/stages/00-status-and-resume.md`.
- Produces: `status <investigation-id>` + `resume <investigation-id>` entry points; existing stage commands stay available.

- [x] Add only arg forwarding + shared-file refs to Claude/Copilot adapters.
- [x] Retarget existing direct-stage adapters to `RULES.md`, `CONTRACT.md`, matching stage files, so no stale duplicate rules carried.
- [x] Add Codex plain-language instructions for both actions, keep existing direct-stage table.
- [x] Make `/qa status <id>` and `/qa resume <id>` the Claude entry points, stage ownership unchanged.

### Task 3: Document and review behavior

**Files:**
- Modify: `qa-harness/README.md`
- Modify: `docs/architecture.md`

- [x] Document what report means, stop conditions, external generator boundary.
- [x] Add resolver + its read-only/write boundaries to architecture diagram and source-of-truth hierarchy.
- [x] Review all linked paths, check three resolver examples against contract.
- [x] Run `git diff --check`; check final diff, leave unrelated planning drafts untouched.