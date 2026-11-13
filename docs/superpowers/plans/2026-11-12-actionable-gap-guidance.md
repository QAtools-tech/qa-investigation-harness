# Actionable Gap Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Show one evidence-based next action for each actionable traceability gap and each non-comparable saved-run comparison row.

**Architecture:** Derive matrix guidance from existing structured row state and add it to Markdown and CSV output. Derive comparison guidance from each side's evidence state, store it on comparison rows, and render it in Markdown. Keep detection and comparison classifications unchanged.

**Tech Stack:** Node.js ES modules and built-in node:test; no new dependency.

**Spec:** [2026-11-12-actionable-gap-guidance-design.md](../specs/2026-11-12-actionable-gap-guidance-design.md)

## Global Constraints

- Use only current matrix/comparison data and existing reason fields.
- Never present a missing result as a test failure or a passing result as oracle conformance.
- Human decisions remain human-owned; generated test code remains owned by the consuming project.
- Keep Markdown, CSV, JSON, and CLI output consistent with their existing schemas and conventions.
- Do not add scores, automatic repairs, approvals, inferred mappings, Playwright execution, or generator invocation.
- Keep existing source locators and comparison evidence states visible.

## Review Focus

- A freshly rejected risk must not receive a test-generation recommendation; test rejection and stale/unknown approval handling in Task 1.
- A missing or unresolved prerequisite must receive only its earliest useful next action; test precedence and empty-action cases in Task 1.
- A missing selected run differs from a selected run with no matching result; test both in Task 1.
- All non-comparable evidence states must retain their original states/reasons and receive correct guidance, never a regression/recovery label; test in Task 2.
- Imported action text must remain Markdown/CSV escaped, and comparison JSON schema must be versioned for the new field; test rendering and schema version in Tasks 1–2.

---

### Task 1: Add next actions to the traceability matrix

**Files:**
- Modify: qa-harness/checks/traceability-matrix.mjs
- Test: qa-harness/checks/traceability-matrix.test.mjs

**Interfaces:**
- Consumes: Parsed requirement, risk, decision, mapping, plan, run-selection, and validation evidence already supplied to buildTraceabilityMatrix.
- Produces: An optional nextAction string per row; add a Next action column to the Markdown and CSV matrix exports.

- [ ] **Step 1: Add failing matrix guidance tests**
  - Test: missing requirement risk link recommends scope review. Assert: Review requirement scope; add an evidence-backed risk link only if warranted.
  - Test: missing or stale decision blocks mapping guidance. Cover absent, stale, unknown, and ambiguous decisions. Assert: Review the risk and oracle; record or reconcile the human decision.
  - Test: fresh rejected decision has no generation action. Assert the action is empty.
  - Test: missing mapping recommends plan and mapping resolution. Assert: Resolve the approved risk's plan and generated-test mapping.
  - Test: selected run gaps distinguish absent run from absent result. Assert no selected run recommends selecting a saved report; no matching result recommends selecting or producing a report that includes the mapped test.
  - Test: validation state recommends review without inferring from finding prose. Assert missing validation recommends Stage 5 review and a recorded finding recommends reviewing its cited evidence and deciding whether the consuming project's generator should change the test.
  - Test: only earliest unresolved action is shown. Combine approval, mapping, run, and validation gaps; assert only the approval action appears. The no-action case is a fresh rejected risk; assert its action is empty. Do not invent a completed conforming-validation state; current matrix stores validation findings only.
  - Test: matrix Markdown and CSV render next action. Assert the column appears in both and existing CSV formula/quote protections still apply.

- [ ] **Step 2: Run focused matrix tests to confirm they fail**

Run: node --test qa-harness/checks/traceability-matrix.test.mjs
Expected: new next-action assertions fail because rows and exports have no action field.

- [ ] **Step 3: Derive one action from each row's existing state**

Derive nextAction while buildTraceabilityMatrix constructs each row, using the parsed requirement/risk/decision state and existing mapping, execution, validation, and run-selection state. Prefer, in order: missing requirement-to-risk link; absent/stale/unknown/ambiguous decision; missing or unresolved mapping; missing run evidence; missing validation or a recorded finding. A fresh rejected decision gets no test-generation action. Do not infer from risk or finding prose.

- [ ] **Step 4: Render and verify focused matrix output**

Add the Next action column to both outputs. Run: node --test qa-harness/checks/traceability-matrix.test.mjs
Expected: all matrix tests pass, including the existing CSV safety cases.

- [ ] **Step 5: Commit Task 1**

Run: git add qa-harness/checks/traceability-matrix.mjs qa-harness/checks/traceability-matrix.test.mjs; git commit -m "feat(qa): guide traceability matrix gaps"

---

### Task 2: Add next actions to non-comparable comparisons

**Files:**
- Modify: qa-harness/checks/run-comparison.mjs
- Modify: qa-harness/checks/qa-run-report.mjs
- Test: qa-harness/checks/run-comparison.test.mjs
- Test: qa-harness/checks/qa-run-report.test.mjs

**Interfaces:**
- Consumes: Existing before/after evidence states, reasons, and comparison rows.
- Produces: nextAction on rows classified not comparable; a Next action column in comparison Markdown; comparison JSON schema version 2. Input run-report schema remains version 2.

- [ ] **Step 1: Add failing comparison and CLI tests**
  - Test: not-comparable rows recommend action by evidence state. Cover no-result, unmapped, project-not-included, and ambiguous; assert actions to add the result, resolve mappings and generate fresh reports, include the project in both runs, and resolve conflicting evidence.
  - Test: comparison next action uses first blocker. Combine non-comparable side states and assert precedence ambiguous, unmapped, project-not-included, then no-result.
  - Test: observed comparison rows have no gap action. Assert classification and both side evidence/reason fields stay unchanged.
  - Test: comparison Markdown renders next action safely. Assert Next action column and escaped text are present.
  - CLI test: compare writes schema version 2 with next action. Assert JSON schemaVersion is 2 and Markdown includes the row action. Existing report inputs remain schema version 2.

- [ ] **Step 2: Run focused comparison tests to confirm they fail**

Run: node --test qa-harness/checks/run-comparison.test.mjs qa-harness/checks/qa-run-report.test.mjs
Expected: new next-action and schema-version assertions fail.

- [ ] **Step 3: Add a deterministic action for non-comparable evidence states**

Add a local recommendation helper in run-comparison.mjs that consumes before/after evidence states, preferring ambiguous, then unmapped, project-not-included, and no-result. Map each state to one concise human action. Do not change classify, per-side reasons, or the input report validator. Bump only comparison JSON schema version from 1 to 2.

- [ ] **Step 4: Render and verify comparison output**

Add the Next action column to comparisonMarkdown. Run: node --test qa-harness/checks/run-comparison.test.mjs qa-harness/checks/qa-run-report.test.mjs
Expected: focused model and CLI tests pass; comparable rows stay unchanged.

- [ ] **Step 5: Commit Task 2**

Run: git add qa-harness/checks/run-comparison.mjs qa-harness/checks/run-comparison.test.mjs qa-harness/checks/qa-run-report.mjs qa-harness/checks/qa-run-report.test.mjs; git commit -m "feat(qa): guide incomparable run evidence"

---

### Task 3: Document the guidance and run the full checks

**Files:**
- Modify: qa-harness/checks/README.md
- Modify: docs/architecture.md
- Modify: docs/superpowers/specs/2026-11-12-actionable-gap-guidance-design.md
- Modify: docs/superpowers/plans/2026-11-12-actionable-gap-guidance.md

- [ ] **Step 1: Document matrix actions and comparison schema version**

Explain the evidence-based Next action field, the no-repair boundary, and comparison schema version 2. Keep existing run-report input schema and comparison requirements clear.

- [ ] **Step 2: Run the complete checks suite and artifact checker**

Run: node --test qa-harness/checks/*.test.mjs
Expected: all checks tests pass.

Run: node qa-harness/checks/qa-check.mjs
Expected: no structural artifact errors.

Run: git diff --check
Expected: no whitespace errors.

- [ ] **Step 3: Commit the branch**

    git add qa-harness/checks/traceability-matrix.mjs qa-harness/checks/traceability-matrix.test.mjs qa-harness/checks/run-comparison.mjs qa-harness/checks/run-comparison.test.mjs qa-harness/checks/qa-run-report.mjs qa-harness/checks/qa-run-report.test.mjs qa-harness/checks/README.md docs/architecture.md docs/superpowers/specs/2026-11-12-actionable-gap-guidance-design.md docs/superpowers/plans/2026-11-12-actionable-gap-guidance.md
    git commit -m "docs(qa): document actionable gap guidance"

## Plan review

Three implementation tasks cover every behavior in the approved design. The matrix uses parsed evidence rather than displayed prose; comparison guidance uses stored evidence states and a fixed precedence. Matrix and comparison guidance use separate existing code paths; CLI integration tests verify schema version 2 and rendering, while existing path-safety behavior remains untouched.
