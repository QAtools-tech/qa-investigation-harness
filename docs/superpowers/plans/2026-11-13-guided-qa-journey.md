# Guided QA Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make guided QA replies clearly show investigation position, blockers, missing evidence, and the next owner action.

**Architecture:** Tighten the shared conversational response guidance and extend its existing synthetic walkthrough. Keep `stages/00-status-and-resume.md` as the only saved-state resolver and leave detailed explicit status output unchanged.

**Tech Stack:** Markdown guidance and walkthroughs; no runtime or dependencies.

**Spec:** [Guided QA journey design](../specs/2026-11-13-guided-qa-journey-design.md)

## Global Constraints

- `qa-harness/stages/00-status-and-resume.md` remains authoritative for saved progress and blockers.
- `qa-harness/GUIDED-CHAT.md` owns shared conversational response guidance; stage files retain their required previews and findings.
- Keep the guide concise: show only fields with useful evidence, and never infer an external path was checked when its project root was not supplied.
- Do not add a CLI, state store, artifact fields, or a second progress resolver.
- Do not change stage eligibility, artifact writes, human approval, validation, or generator boundaries.

## Review Focus

- A missing consuming-project root must be reported as “not checked,” not confirmed absent; covered by the unchecked-path walkthrough scenario.
- A ready generator handoff must not imply tests already exist; covered by the handoff walkthrough scenario.
- A pending risk review must name the human decision and `risks.md`; covered by the risk-review walkthrough scenario.
- A direct review with no supported follow-up must not invent a next action; covered by the completed-review walkthrough scenario.

---

### Task 1: Make progress summaries consistent

**Files:**
- Include: `docs/superpowers/specs/2026-11-13-guided-qa-journey-design.md`
- Include: `docs/superpowers/plans/2026-11-13-guided-qa-journey.md`
- Modify: `qa-harness/GUIDED-CHAT.md`
- Modify: `qa-harness/walkthroughs/guided-chat.md`

**Interfaces:**
- Consumes: route findings and saved-state outcomes from the existing stage files and `qa-harness/stages/00-status-and-resume.md`.
- Produces: a short post-action response contract and synthetic walkthrough expectations; no runtime interface.

- [x] **Clarify post-action fields in the shared guide.** Require the confirmed investigation ID and position (or route name before ID confirmation); include `Completed` when useful; when blocked, name the decision/input and evidence location; distinguish “not checked” from “not found”; give one `Next · <owner>` action; include `Return with` only when saved work can resume by ID. Keep explicit status requests on the detailed resolver format and do not force empty fields into replies.
- [x] **Extend the existing walkthrough.** Add synthetic scenarios for pending human risk review, an approved plan whose external test path was not checked, ready generator handoff, and completed direct plan review. For each, state the setup, prompt, expected position/blocker or completion, and next action or its absence. Preserve current intake, triage, and resume cases.
- [x] **Review consistency and links.** Compared the guide and walkthrough against the resolver's existing stop conditions; confirmed examples do not claim approval, test generation, or path checks without evidence. Relative Markdown links resolve and `git diff --cached --check` passes.
- [x] **Commit the design, plan, and documentation change together.** Committed as `docs(qa): clarify guided progress summaries`.
