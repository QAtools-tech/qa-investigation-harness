# Generator Handoff Summary Design

## Intent

Help a QA user move from an approved investigation to their consuming project's Playwright test-generation agent. The user needs a concise, evidence-linked handoff that names the plan, approved cases, mapped test paths, and anything that still blocks generation.

## Goals

- Build a read-only Markdown handoff summary from the selected investigation and its traceability matrix.
- List a case as ready only when its risk has one explicit, fresh approval and its plan entry and mapped test path resolve unambiguously.
- Keep blocked, stale, unknown, or ambiguous cases visible with their reason and source locator.
- Give the human a concise instruction to pass to the consuming project's test-generation agent.
- Let the chat present the summary directly; permit a CLI stdout form without writing files.

## Non-goals and anti-goals

- The harness does not invoke a generator agent, author or edit Playwright code, modify the plan, or create an approval or mapping.
- Do not replace the existing plan as the generator's source of behavioral detail.
- Do not imply that a mapped path means a generated test exists or that a passing run proves oracle conformance.

## Constraints

- Reuse the existing matrix and coverage evidence, investigation ID rules, source locators, and freshness decisions.
- Keep all generated output read-only and local to the selected investigation.
- Follow the repository boundary: Stage 3 creates the human-reviewed plan; the consuming project owns test generation; Stage 5 audits generated tests.

## Approaches

1. **Add a handoff section to every matrix.** This would expand a general coverage report even when the user only wants status.
2. **Build a dedicated, read-only handoff summary from matrix rows.** This keeps coverage reporting and generator preparation separate while reusing the existing evidence and freshness logic. **Recommended and selected.**
3. **Invoke or adapt the consuming project's generator.** This crosses the established repository boundary, depends on project-specific tools and permissions, and risks turning the harness into a test author.

## Proposed behavior

Add an explicit `handoff` action for one investigation. It prints Markdown to stdout by default. The summary identifies the investigation and canonical plan path, lists ready cases with risk, TC ID, mapped path, and source locators, and lists blocked cases with their exact readiness reason. When at least one case is ready, include a short copyable generator instruction that points to the canonical plan and names the ready TC IDs and file paths. Do not put risk approval metadata into the plan or alter any artifacts.

In guided chat, “Prepare the Playwright generator handoff for <investigation-id>” shows this summary and leaves the final handoff action with the human. If no case is ready, show blockers and the next human action without a generator instruction.

## Builder decisions

- Reuse `buildCoverage(..., { includeMatrixEvidence: true })` and `buildTraceabilityMatrix`; do not introduce a second parser or freshness implementation.
- Require `mappingStatus === "current"` for the ready list. Keep every other row in the blocked list, grouped by case where possible.
- Show test source existence as prerequisite evidence, not as proof that generated coverage exists.
- Do not add artifact export or generator invocation in this step.

## Approval boundary

This document captures the proposed Step 2 scope. Implementation starts only after the human approves it.
