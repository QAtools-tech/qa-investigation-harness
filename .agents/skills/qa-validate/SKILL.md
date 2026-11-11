---
name: qa-validate
description: Audit generated tests against approved oracles; mutate assertions only when explicitly requested.
---

Read `qa-harness/RULES.md`, `qa-harness/CONTRACT.md`, and
`qa-harness/stages/05-validate.md`; follow them exactly. Never author tests or
repair weak assertions. Run mutation checks only when explicitly requested,
and restore every temporary change immediately.
