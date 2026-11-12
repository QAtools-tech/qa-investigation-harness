# Contributing

Thank you for helping improve the QA Investigation Harness. This repository is a documentation-and-prompt project: contributions should make the investigation contract clearer, safer, or easier to use without changing the consuming project's application behavior.

For current client boundaries, use the [compatibility matrix](docs/compatibility.md).
Preserve legacy ticket paths and approval history as described in the
[migration guide](docs/migration.md).

## Before editing

Read these files in order:

1. [`qa-harness/RULES.md`](qa-harness/RULES.md) — shared hard rules and artifact contract.
2. The relevant stage file under [`qa-harness/stages/`](qa-harness/stages/) — exact behavior for the stage being changed.
3. The adapter being updated, if the change is tool-specific: [`.github/prompts/`](.github/prompts/), [`.claude/skills/`](.claude/skills/), [`AGENTS.md`](AGENTS.md), or [`CLAUDE.md`](CLAUDE.md).

The shared rules and stage files are the source of truth. Keep adapters thin; do not copy methodology into a tool-specific file when a link or short invocation wrapper is enough.

## What belongs here

- Clarifications to the stage instructions or artifact formats.
- Corrections to tool adapter invocation details.
- Documentation improvements grounded in files that exist in this repository.
- Safer handling of non-production URLs, credentials, evidence gaps, and stale artifacts.
- Repository hygiene and contribution workflow improvements.

## What does not belong here

- Playwright test files or seed files. The consuming project's test-generation agent owns those.
- Real QA findings, credentials, private URLs, or production data.
- Claims about application behavior that were not observed or documented by the consuming project.
- Unrelated framework upgrades, deployment infrastructure, or application refactors.

## Making a change

1. Explain the user-facing or maintainer-facing problem in the pull request.
2. Identify whether the change affects shared rules, one adapter, documentation, or repository metadata.
3. Preserve the stage order and the human approval boundary.
4. Keep examples generic. Use placeholder ticket IDs and non-production example URLs only.
5. Update linked documentation when a path or artifact contract changes.
6. Inspect the final diff for accidental prompt-behavior changes, unsupported claims, broken links, and secrets.

## Local checks

This repository has no application runtime, package manifest, or dependency install. The checker, offline report tool, and Node.js test suite use built-in modules; Node.js 20 or newer is required. Run the full suite and repository checks before opening a pull request:

```powershell
git diff --check
node --test qa-harness/checks/*.test.mjs qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs
node qa-harness/checks/qa-check.mjs
rg --files -uu | Sort-Object
rg -n -i --hidden --glob '!**/.git/**' --glob '!**/.codebase-memory/**' '(api[_-]?key|secret|password|token|private[_-]?key|BEGIN [A-Z ]+PRIVATE KEY|postgres://|mongodb://)' .
```

The full Node test suite includes the local Markdown-link integration check;
run only that check with
`node --test qa-harness/checks/markdown-links.test.mjs`. Review secret-scan
matches: examples may intentionally name sensitive field types, but fixture
values must never contain real credentials. For SVG changes, parse the files
as XML and confirm the intended `viewBox`. For Markdown changes, review the
rendered hierarchy once before opening a pull request.

## Pull requests

Use the repository pull-request template. A good pull request is small enough to review, states which source-of-truth files it touched, lists the checks that ran, and calls out any known limitation instead of hiding it behind marketing language.

