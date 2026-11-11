---
name: qa-validation-review
description: Compare one mapped test's assertions to fresh human-approved oracles.
---

Read `qa-harness/stages/validation-reviewer.md` and follow it exactly. This
Codex skill guides a read-only review but does not enforce a tool allowlist.
Do not run tests or edit files. Stop affected conformance judgments for
missing/stale approval or unresolved mappings. If the host does not provide a
read-only reviewer, keep this work in the parent workflow and inspect tool
permissions.
