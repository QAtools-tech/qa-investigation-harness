# Generator Round-Trip Guide Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Give QA users one copyable guide from a fresh approved plan through an external generator and back to imported Playwright evidence and Stage 5 review.

**Architecture:** Add one canonical, generator-neutral guide that connects existing shared workflow and CLI commands. Link it from the general harness README and the status/resume resolver at the generator-handoff boundary; do not duplicate the workflow in tool adapters.

**Tech Stack:** Markdown documentation; existing Node.js CLI examples only.

**Spec:** [2026-11-13-generator-round-trip-guide-design.md](../specs/2026-11-13-generator-round-trip-guide-design.md)

## Global Constraints

- Do not generate or edit Playwright test code, invoke a consuming-project generator, run Playwright, or write to an external provider.
- Do not add a new CLI command, import format, schema, or project-specific generator integration.
- Keep the existing human approval, evidence freshness, and Stage 5 review boundaries.
- Reuse the current `handoff`, `matrix`, and offline `qa-run-report` commands and the existing Stage 5 instructions.
- The harness must distinguish generated-source presence from an executed test result, and a runner pass from oracle conformance.

## Review Focus

- A mapping whose generated file is missing or stored outside the consuming-project root must be reported as unconfirmed or blocked; the guide must not imply that a plan or mapping proves generation occurred.
- The read-only `handoff` summary may classify an absent generated file as blocked; explain when that is the expected external-generator handoff state and preserve status/resume as the authority for approval blockers.
- A Playwright report with an unknown run ID, target, or revision must leave that provenance unknown; examples must not invent values.
- An imported test result with no oracle validation must remain unreviewed; the guide must route to Stage 5 without treating runner success as conformance.
- A report or output path outside the selected root must not be encouraged; examples must respect the CLI's root and existing-parent requirements.
- The guide must stop at external generator and Playwright execution boundaries; no command should imply harness-owned execution.

---

### Task 1: Add and link the generator round-trip guide

**Files:**
- Create: `qa-harness/GENERATOR-ROUND-TRIP.md`
- Modify: `qa-harness/README.md`
- Modify: `qa-harness/stages/00-status-and-resume.md`

**Interfaces:**
- Consumes: Existing `status`/`resume` resolver, `handoff`, `matrix`, offline run-report importer, and `stages/05-validate.md`.
- Produces: A single canonical workflow linkable from repository onboarding and the generator-handoff resume route.

- [ ] **Step 1: Write the canonical workflow**

Document these stages in order: confirm current approval and mapping with status; print the read-only handoff; give the external generator the approved `specs/<id>.plan.md`; check mapped test source under the consuming-project root; run Playwright in that project; import its existing JSON using `qa-run-report.mjs` with user-supplied run ID and target and optional known revision; inspect matrix/report evidence; continue to Stage 5 validation against the approved oracle; optionally compare saved runs.

Use placeholders that clearly identify user-supplied project paths and metadata. Give exact existing command shapes for handoff, matrix, and report import. State where each artifact is written and what evidence it does or does not establish. Include the action to take when the generated file is absent, a path does not match the approved mapping, a test has no matching result, or its assertion has not been validated.

- [ ] **Step 2: Link the shared guide from the README**

Add one pointer in the existing README workflow/setup section. Do not repeat command details there.

- [ ] **Step 3: Link the guide at generator handoff in status/resume**

Add one pointer where the resolver reports current plan/mapping and missing generated source. Keep the resolver as the source of eligibility rules and keep its current stop conditions unchanged.

- [ ] **Step 4: Review the documentation diff**

Manually compare every example with the current CLI usage and the referenced Stage 5 instructions. Confirm the links target existing files, the order is clear, and no step crosses the external generator or Playwright boundary.

- [ ] **Step 5: Check whitespace and commit**

Run: `git diff --check`

Expected: no whitespace errors.

Commit:

```sh
git add qa-harness/GENERATOR-ROUND-TRIP.md qa-harness/README.md qa-harness/stages/00-status-and-resume.md
git add docs/superpowers/specs/2026-11-13-generator-round-trip-guide-design.md docs/superpowers/plans/2026-11-13-generator-round-trip-guide.md
git commit -m "docs(qa): connect generator round trip"
```

## Plan review

One docs-only task owns the shared guide and its two entry-point links. There is no independent behavior or interface requiring a separate task. Automatic tests are omitted because this change adds no code; command and link accuracy receive manual review, and `git diff --check` covers whitespace.
