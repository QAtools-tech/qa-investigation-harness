# Generator Handoff Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a QA user prepare a concise, evidence-linked brief for their project's Playwright test generator.

**Architecture:** Add a pure handoff renderer over existing traceability matrix rows, then expose it as a read-only CLI action and a guided-chat route. Only matrix rows marked `current` qualify as ready; every other row stays visible as blocked.

**Tech Stack:** Node.js built-ins, existing Markdown investigation artifacts, existing matrix builder.

**Spec:** `docs/superpowers/specs/2026-11-12-generator-handoff-summary-design.md`

## Global Constraints

- Keep the stage boundary: the harness produces the approved plan, the consuming project owns test generation, and Stage 5 audits generated tests.
- The handoff action reads one investigation, writes no files, invokes no agent, and authors no Playwright code.
- Ready entries require `mappingStatus === "current"` from the existing matrix.
- Keep the canonical `specs/<investigation-id>.plan.md` as the source of behavioral detail.

## Review Focus

- A stale, unknown, rejected, missing, or ambiguous decision must never enter the ready list; pin this in Task 1's readiness test.
- A requirement with no risk or a risk with no mapping must remain visible as blocked; pin this in Task 1's blocker-rendering test.
- Repeated matrix rows for a case must not duplicate generator work; pin this in Task 1's deduplication test.
- Imported risk text and paths must not create Markdown table or link structure; pin this in Task 1's escaping test.
- The CLI must not write artifacts or invoke Playwright; pin this in Task 1's stdout-only CLI test.

## File Map

- Create `qa-harness/checks/generator-handoff.mjs` for projection, readiness grouping, and Markdown rendering.
- Create `qa-harness/checks/generator-handoff.test.mjs` for projection, escaping, and CLI coverage.
- Modify `qa-harness/checks/qa-run-report.mjs` to add the `handoff` stdout action using the existing coverage and matrix builders.
- Modify `qa-harness/GUIDED-CHAT.md` and `qa-harness/checks/README.md` to document the conversational route and CLI usage.

## Task 1: Build and expose the read-only generator handoff

**Files:**
- Create: `qa-harness/checks/generator-handoff.mjs`
- Create: `qa-harness/checks/generator-handoff.test.mjs`
- Modify: `qa-harness/checks/qa-run-report.mjs`
- Modify: `qa-harness/GUIDED-CHAT.md`
- Modify: `qa-harness/checks/README.md`

**Interfaces:**
- Consumes: `buildCoverage(root, id, null, { includeMatrixEvidence: true })` and `buildTraceabilityMatrix(coverage)`.
- Produces: `buildGeneratorHandoff(matrix) -> string`, Markdown written to stdout by `qa-run-report.mjs handoff --root <project> --investigation <id>`.

- [x] **Step 1: Add tests in `generator-handoff.test.mjs`**
  - `freshly approved mapped cases are ready, stale or unresolved rows are blocked`: assert only rows with `mappingStatus: "current"` appear under Ready cases; stale, unknown, not-approved, and ambiguous rows appear under Blocked cases with their status.
  - `blocks actual fresh approvals when the same TC maps to different files`: build real fixture artifacts with two fresh decisions sharing one TC ID and assert coverage, matrix, and handoff all keep the mappings ambiguous.
  - `duplicate rows for the same TC and file produce one generator instruction`: assert the TC/path appears once and retains all risk IDs and source locators.
  - `missing coverage links stay visible and suppress instructions when nothing is ready`: assert no-risk and no-mapping rows are listed as blockers and no copyable instruction appears.
  - `imported text is escaped in Markdown output`: include pipe characters in risk text and mapped paths, plus newline, angle brackets, and link-shaped content; assert pipes have exactly one escape and text stays plain.
  - `handoff CLI prints Markdown without creating artifacts`: run the CLI against the synthetic fixture and assert the plan path and blocked case appear, exit code is zero, and no output files are created.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test qa-harness/checks/generator-handoff.test.mjs`

Expected: tests fail because the handoff builder and CLI route do not yet exist.

- [x] **Step 3: Implement `buildGeneratorHandoff(matrix)`**

In `generator-handoff.mjs`, deduplicate rows by TC ID and mapped path. Put only rows whose mapping status is `current` in the ready list. Render every other row as a blocked entry with status and locators. Include a copyable generator instruction naming the canonical plan, ready TC IDs, and mapped paths only when at least one case is ready. Escape imported strings for Markdown.

- [x] **Step 4: Add the `handoff` CLI route**

In `qa-run-report.mjs`, accept only `--root` and `--investigation` after `handoff`; reuse existing path-safe coverage loading and matrix projection with no selected run. Print the handoff Markdown to stdout. Reject unknown, duplicate, or missing arguments. Do not add output-file flags or generator invocation.

- [x] **Step 5: Add the guided chat route and docs**

In `GUIDED-CHAT.md`, route “Prepare the Playwright generator handoff for <investigation-id>” to saved evidence and present the result without claiming generation occurred. In checks README, add the CLI form and state that the command is read-only and does not invoke the project's generator.

- [x] **Step 6: Run focused and full tests**

Run: `node --test qa-harness/checks/generator-handoff.test.mjs`

Expected: all handoff tests pass.

Run: `node --test qa-harness/checks/*.test.mjs`

Expected: the full Node test suite passes.

## Completion Criteria

- Human sees ready cases and blocked cases separately, each with source locators.
- Copyable generator guidance appears only when there is at least one ready case.
- The CLI reads existing artifacts and writes only stdout.
- The consuming project's test-generation agent remains responsible for Playwright code.

## Verification and review

- Focused handoff and matrix tests: 12/12 pass.
- Full checks suite: 75/75 pass (`node --test qa-harness/checks/*.test.mjs`).
- `git diff --check` passes.
- Fresh review found and the implementation fixed two important issues: conflicting TC-to-file mappings could be marked ready, and pipe escaping doubled its escape character. Both fixes have regression coverage.
