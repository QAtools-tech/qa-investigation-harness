# Deterministic QA artifact checks

The optional checker is a read-only structural check for Phase 3
`investigation.md` imports, Stage 3 risk tables, and generated mappings. It
reports file and line locations. It does not infer approval, evaluate oracle
quality, decide freshness, export plans, edit artifacts, or author tests.

## Manual use

Requires Node.js 20 or newer; no package install is needed.

```sh
node qa-harness/checks/qa-check.mjs
node qa-harness/checks/qa-check.mjs --root path/to/consuming-project
node --test qa-harness/checks/*.test.mjs
```

With no `qa-artifacts/` directory, the checker reports that there is nothing
to check and exits successfully. The checker validates every direct
`qa-artifacts/<id>/investigation.md` and `risks.md` it finds. It checks risk
IDs, required fields, allowed statuses, and mappings against the canonical
`specs/<id>.plan.md` TC IDs. It never changes the source files.

## Optional Codex hook

`../hooks/codex-hooks.example.json` is an opt-in example for Codex's local
`PostToolUse` event after `apply_patch`. Review the command and copy its
contents to `.codex/hooks.json` only when you want automatic diagnostics.
Project hooks require trust review in Codex; inspect the hook with `/hooks`
before trusting it. It is not a policy boundary: the edit already happened
before `PostToolUse` runs. Malformed hook input fails open with manual-check
guidance. The hook returns diagnostics as context and never blocks, edits, or
approves.

The hook checks only Codex `apply_patch` tool activity. Shell-based edits and
other clients should run the manual command. CI runs the same checker against
the synthetic fixture and runs its Node test suite.

## Limits

The checker covers structure only. `status`/`resume` remain authoritative for
approval freshness and next-action routing. Human review remains authoritative
for risk decisions and expected behavior.
