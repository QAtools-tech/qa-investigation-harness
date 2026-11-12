---
name: qa
description: Inspect QA investigation status or resume its next eligible action. Invoke manually; do not trigger automatically.
argument-hint: <status|resume> <investigation-id>
arguments: [action, investigationId]
disable-model-invocation: true
---

Read `qa-harness/RULES.md`, `qa-harness/CONTRACT.md`, and
`qa-harness/stages/00-status-and-resume.md`, then follow the shared resolver
exactly.

For resume, use `qa-harness/GUIDED-CHAT.md` for the user-facing summary after
applying the resolver. Keep the resolver's detailed output for status.

Action: $action
Investigation: $investigationId
