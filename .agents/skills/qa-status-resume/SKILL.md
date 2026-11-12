---
name: qa-status-resume
description: Report QA investigation status or resume its next eligible action.
---

Read `qa-harness/RULES.md`, `qa-harness/CONTRACT.md`, and
`qa-harness/stages/00-status-and-resume.md`; follow the shared resolver
exactly.

For resume, use `qa-harness/GUIDED-CHAT.md` for the user-facing summary after
applying the resolver. Keep the resolver's detailed output for status.

Status is read-only. Resume must preserve approval, freshness, generator
handoff, and one-flow boundaries. Name missing evidence and stop before any
action blocked by missing or stale approval.
