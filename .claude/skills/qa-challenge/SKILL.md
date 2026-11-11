---
name: qa-challenge
description: Stage 3 of the QA investigation harness. Propose risks or export only after human approval.
argument-hint: <investigation-id> [run Part B]
arguments: [ticketId, part]
disable-model-invocation: true
---

Read `qa-harness/RULES.md` and `qa-harness/CONTRACT.md`, then read and follow
`qa-harness/stages/03-challenge.md` exactly.

Investigation ID: $ticketId
Requested part: $part
Arguments: $ARGUMENTS
