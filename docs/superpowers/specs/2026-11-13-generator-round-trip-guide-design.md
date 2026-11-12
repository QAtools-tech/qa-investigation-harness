# Generator Round-Trip Guide Design

## Intent

Help a QA user carry one approved investigation through the consuming project's external test generator, then return generated test and Playwright evidence to the harness for review. The repository already has the handoff, matrix, offline run-report importer, status/resume resolver, and Stage 5 validation instructions; this change connects those steps in one usable path.

## Goals

- Give a copyable sequence from a fresh approved plan through generator handoff, generated-source check, Playwright report import, and oracle validation.
- Name the owner and evidence needed at each handoff, including what the user should do when evidence is missing or cannot be matched.
- Keep investigation ID, approved TC mapping, source paths, and run provenance consistent across the return path.
- Link the shared instructions from the existing README and status/resume handoff guidance instead of duplicating the process in tool-specific adapters.

## Non-goals and constraints

- Do not generate or edit Playwright test code, invoke a consuming-project generator, run Playwright, or write to an external provider.
- Do not add a new CLI command, import format, schema, or project-specific generator integration.
- Keep the existing human approval, evidence freshness, and Stage 5 review boundaries.
- Reuse the current `handoff`, `matrix`, and offline `qa-run-report` commands and the existing Stage 5 instructions.

## Approaches

1. **Canonical round-trip guide — selected.** Add one focused shared guide with the exact sequence and links, then point the main README and status/resume handoff route to it. Small, generator-neutral, and reuses current commands.
2. **Post-generation CLI command.** Add a new command that checks mapped files and imported run evidence. It would duplicate status and matrix checks, with a new interface to maintain.
3. **Generator or Playwright orchestration.** Invoke a consuming-project generator or browser run from this repository. Rejected because the consuming project owns test generation and execution, and the harness's boundary is deliberately human-controlled.

## Proposed workflow

1. Confirm `status <id>` reports fresh approved risks and a current plan/mapping; stop for missing or stale approval.
2. Print the read-only generator handoff and give the external generator `specs/<id>.plan.md` plus the approved mapping context.
3. In the consuming project, inspect the mapped test paths and ask the human to resolve missing or mismatched source before proceeding.
4. Run Playwright in that project, then import its existing JSON report with `qa-run-report.mjs`, recording run ID, target, and revision when known.
5. Return with `Continue QA for <id>` or run `status <id>`, inspect the matrix/report evidence, and route to Stage 5 validation against the approved oracle.
6. If comparing runs, use the existing comparison command and preserve not-comparable states and reasons.

The guide must distinguish generated-source presence from an executed test result, and a runner pass from oracle conformance. It must name the consuming-project root and report path as user-supplied inputs rather than guessing them.

The `handoff` CLI summary can classify a not-yet-generated mapped source as blocked. When the status/resume resolver confirms that this is the expected pre-generation state and approval/mapping prerequisites are current, direct the user to the external generator with the approved plan; do not treat the CLI's missing-source state as a failed test or as stale approval.

## Deliverables and open builder choices

- Add `qa-harness/GENERATOR-ROUND-TRIP.md` as the canonical workflow.
- Link it from `qa-harness/README.md` and the generator-handoff part of `qa-harness/stages/00-status-and-resume.md`.
- Use existing commands and artifacts; the builder may choose concise examples and link placement consistent with surrounding docs.
