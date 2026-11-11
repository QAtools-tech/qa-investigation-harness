---
name: qa-validate
description: Stage 5 of the QA investigation harness. Audit generated tests and run mutation checks only on request.
argument-hint: <investigation-id> [run Part B]
arguments: [ticketId, part]
disable-model-invocation: true
---

Read `qa-harness/RULES.md` and `qa-harness/CONTRACT.md`, then read and follow
`qa-harness/stages/05-validate.md` exactly.

Investigation ID: $ticketId
Requested part: $part
Arguments: $ARGUMENTS
