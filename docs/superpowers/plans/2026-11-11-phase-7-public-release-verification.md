# Phase 7 Public Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify two public first-run QA harness journeys from a clean checkout and publish accurate compatibility, migration, and contributor guidance.

**Architecture:** Keep the investigation workflow in the canonical contract and stage files. Add concise walkthroughs that link to those rules, make existing synthetic fixtures usable for the examples, and add deterministic documentation checks to the built-in Node suite. Use a fresh independent agent for the walkthrough attempt and record exact limits.

**Tech Stack:** Markdown, existing synthetic fixtures, Node.js 20+ built-ins, Git worktree or isolated checkout for verification.

**Spec:** `docs/superpowers/specs/2026-11-11-phase-7-public-release-verification-design.md`

## Global Constraints

- Do not write Playwright test code or seed files.
- Use only synthetic repository fixtures; do not include credentials, provider data, or production URLs.
- Preserve legacy `qa-artifacts/<ticket>/` and `specs/<ticket>.plan.md` behavior and approval history.
- Distinguish documented configuration, fixture-tested behavior, and live-verified behavior.
- Do not mark risks approved/rejected in the harness or let a guide imply export without fresh human approval.
- Keep the phase branch based on Phase 6; do not merge or publish a release as part of this work.

## Review Focus

- Missing or stale approval must stop before handoff — exercise both in the CSV walkthrough and test named stop text.
- A supplied failed run must route to triage, while an approved-risk audit names missing approval, mapping, or test source — test both routes against the spec/run walkthrough.
- Compatibility claims can overstate fixture coverage as live support — constrain each row to an explicit verification label and test for the status vocabulary.
- Migration advice can accidentally rewrite legacy identity or approval — test that the guide preserves originals, IDs, decisions, and TC mappings.
- Relative documentation links can break from the repo root — add a deterministic local-link check over public entry-point documents.

---

### Task 1: Build reproducible public walkthroughs

**Files:**
- Create: `qa-harness/walkthroughs/csv-case-to-approved-handoff.md`
- Create: `qa-harness/walkthroughs/spec-and-failed-run.md`
- Modify: `qa-harness/examples.md`
- Modify or create: synthetic walkthrough fixtures under `qa-harness/fixtures/walkthroughs/`

**Interfaces:** Use entry-point rules in `qa-harness/CONTRACT.md`; CSV preview rules in `qa-harness/INTAKE.md`; approval and export rules in `qa-harness/stages/03-challenge.md`; direct triage and approved-risk audit boundaries in `qa-harness/stages/05-validate.md`; report metadata in `qa-harness/checks/README.md`.

- [x] **Step 1: Add or extend only synthetic fixture records needed for deterministic examples.** Include a blank CSV expectation, a clarified claim with source locator, and a changed-oracle/stale-decision variant; keep the run scenario based on `fixtures/run-report/` and preserve its non-executable test placeholder.
- [x] **Step 2: Write both walkthroughs** with exact fresh-chat prompts, chosen entry point, fixture paths, expected evidence, human pause, resume prompt, missing/stale approval stop, missing test-source and unresolved-mapping limits, and a concise first-run checklist. Show handoff only as a conditional after explicit fresh approval.
- [x] **Step 3: Cross-check every stage action and expected stop against the canonical contract; record scenario assumptions directly in the walkthrough.** The independent agent rehearsal, not a source-text assertion, validates whether the instructions cause the expected behavior.

### Task 2: Publish compatibility and migration guidance

**Files:**
- Create: `docs/compatibility.md`
- Create: `docs/migration.md`

**Interfaces:** Compatibility follows current adapters in `.agents/skills/`, `.claude/skills/`, `.github/prompts/`, host configuration files, `qa-harness/adapters/README.md`, and the phase 0 provider reference notes. Migration follows `qa-harness/CONTRACT.md` identity, approval, and legacy compatibility rules.

- [x] **Step 1: Write the compatibility matrix** listing only evidenced entry points and runtime requirements. Mark the local Node checker/report fixture-tested; mark Jira normalization fixture-tested but its live host binding not verified; mark unimplemented provider adapters accordingly. Cite official documentation for version-sensitive client claims and keep edition/access unknown where not verified.
- [x] **Step 2: Write the migration guide** for retaining old ticket IDs and paths, assigning local IDs to new work, preserving approval and mapping history, and reviewing stale or conflicting artifacts manually. Do not provide an automatic migration command.
- [x] **Step 3: Cross-check every compatibility and migration statement against current repository evidence and the canonical identity/approval contract.**

### Task 3: Align public entry points and contribution instructions

**Files:**
- Modify: `README.md`
- Modify: `qa-harness/README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/architecture.md` only where its release or compatibility claims disagree with verified behavior

**Interfaces:** Link to the walkthrough, compatibility, and migration docs; retain `qa-harness/RULES.md` and stage files as the single source of truth.

- [x] **Step 1: Update top-level and harness READMEs** with a short choose-an-entry-point section and links to both walkthroughs, compatibility limits, and migration guide. Remove outdated duplicate instructions without dropping safety boundaries.
- [x] **Step 2: Update CONTRIBUTING.md** with the exact full built-in Node test command, checker/report fixture checks, local link check, and credential scan; state that generated tests belong to the consuming project.
- [x] **Step 3: Review changed claims against the canonical contract and adapters.**

### Task 4: Verify docs and preserve legacy behavior

**Files:**
- Create: `qa-harness/checks/markdown-links.mjs`
- Create: `qa-harness/checks/markdown-links.test.mjs`
- Create: `docs/release/phase-7-verification.md` as an in-progress placeholder; Task 5 replaces it with recorded evidence

**Interfaces:** Export `checkMarkdownLinks({ root, files }) -> { checkedFiles, issues }` from `markdown-links.mjs`; use Node.js built-ins only; resolve relative inline Markdown links and image targets from their containing file; ignore external URLs and same-file fragments. No CLI is needed; the integration test is the repeatable local link check.

- [x] **Step 1: Write failing behavior tests** named `resolves local Markdown links from the containing file`, `reports a missing local Markdown target with its source locator`, and `ignores external URLs and same-file anchors`. Use temporary Markdown fixtures with literal expected paths and diagnostics.
- [x] **Step 2: Run the targeted test** and confirm it fails because the exported checker is missing.
- [x] **Step 3: Implement the bounded local-link checker**; do not add dependencies or auto-fix docs.
- [x] **Step 4: Add an integration test** that runs the checker on the public document set and confirms no local target is missing. This tests link resolution, not doc prose.
- [x] **Step 5: Run full verification:**

  Run: `node --test qa-harness/checks/*.test.mjs qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs`

  Expected: all tests pass, including public docs links and existing legacy/checker fixtures.
- [x] **Step 6: Run repository audits:** `git diff --check`, the CONTRIBUTING credential-pattern scan (review matches as documentation literals vs actual secrets), and a manual diff review for unsupported claims, stale links, IDs, approval status, and accidental executable tests.

### Task 5: Independent first-run rehearsal and phase report

**Files:**
- Create: `docs/release/phase-7-verification.md`
- Modify: walkthroughs and documentation only for defects demonstrated by the reviewer

**Interfaces:** Start from a clean checkout snapshot of the Phase 7 branch. The fresh agent receives only the walkthroughs, public repo materials, and synthetic fixtures; do not send design or plan commentary that would reveal the expected route.

- [x] **Step 1: Prepare an isolated checkout snapshot** by archiving the Phase 6 branch base and overlaying only the planned Phase 7 files from the working tree; exclude pre-existing unrelated untracked user files and `.git` metadata.
- [x] **Step 2: Ask a fresh agent that did not build Phase 7 to follow both walkthroughs independently** and record its first selected entry point, questions/blockers, evidence it named, approval/export behavior, and any unexpected manual repair.
- [x] **Step 3: Fix each demonstrated important documentation or harness defect** with focused regression evidence (behavior tests for code; a fresh corrected rehearsal for human-facing flow); repeat both walkthroughs once from the corrected snapshot.
- [x] **Step 4: Write the phase report** with first attempt, corrections, second attempt, full suite result, local audit results, and explicit unverified real-human, browser, consuming-project generator, and live-provider checks. Do not claim first-run reliability from an agent-only attempt.
- [x] **Step 5: Run full verification again** and inspect `git status --short --branch` to confirm unrelated untracked files remain untouched.

## Final Review

- [x] Have a fresh read-only reviewer inspect the complete Phase 7 diff for safety boundaries, legacy compatibility, unsupported client/provider claims, source-of-truth duplication, and whether the two recorded walkthrough outcomes support the stated claims.
- [x] Address each important finding with a focused regression check and one fix pass; record deferred minor items in the report.
- [ ] Report the verified commit candidate and remaining external checks; do not commit, push, or publish without the user's request.
