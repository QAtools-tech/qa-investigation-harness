# QA Investigation Harness

This file is a thin adapter. The shared contract and stage instructions are
the source of truth; do not duplicate their rules here.

- For `status <investigation-id>` or `resume <investigation-id>`, read
  `qa-harness/RULES.md`, `qa-harness/CONTRACT.md`, and
  `qa-harness/stages/00-status-and-resume.md`.
- For a direct stage request, read `qa-harness/RULES.md`, the contract, and
  the matching file under `qa-harness/stages/` before acting.
- Never author Playwright tests or seed files. The consuming project's
  generator owns them.
