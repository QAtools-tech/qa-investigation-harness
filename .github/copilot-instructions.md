# QA Investigation Harness

This file is a thin adapter. The shared contract and stage instructions are
the source of truth; do not duplicate their rules here.

- For `status <investigation-id>` or `resume <investigation-id>`, read
  `qa-harness/RULES.md`, `qa-harness/CONTRACT.md`, and
  `qa-harness/stages/00-status-and-resume.md`.
- For a direct stage request, read `qa-harness/RULES.md`, the contract, and
  the matching file under `qa-harness/stages/` before acting.
- For local case/spec/evidence intake, use `qa-harness/stages/intake.md`;
  preview mapping and grouping and wait for human confirmation before writing.
- For review of an existing plan, use `qa-harness/stages/review-plan.md`;
  report findings without editing source or generator-facing files.
- For risk and validation review, use the scoped agents in `.github/agents/`;
  they have read/search tools only. Parent workflow reconciles cited findings.
- Never author Playwright tests or seed files. The consuming project's
  generator owns them.
