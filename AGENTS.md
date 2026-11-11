# QA Investigation Harness

Use [the investigation contract](qa-harness/CONTRACT.md) to select an entry
point for an existing ticket, local case, spec, or run.

This repo has a risk-driven QA investigation harness. Full rules live in
`qa-harness/RULES.md` — read it in full before running any stage below, and
follow it exactly. Read the relevant stage file under `qa-harness/stages/`
before acting on that stage; do not rely on summaries or memory of it.

Never write Playwright test code yourself. Test generation belongs to this
project's test-generation agent — see `qa-harness/RULES.md` for how to get
one if it doesn't exist yet (`npx playwright init-agents --loop=codex` sets
one up for this tool specifically). This harness only investigates, produces
a human-reviewed test plan, and audits the result.

## Running a stage

There is no slash command here — when the user asks you to run a stage, read
`qa-harness/RULES.md` plus the matching file below, then follow it exactly
using whatever ticket ID, test case, or slug the user gave you in their
message. Ask for anything the stage file requires that wasn't given.

| User asks for | Read |
|---|---|
| "explore" / Stage 1 | `qa-harness/stages/01-explore.md` |
| "model" / Stage 2 | `qa-harness/stages/02-model.md` |
| "challenge" / Stage 3 | `qa-harness/stages/03-challenge.md` |
| "validate" / Stage 5 | `qa-harness/stages/05-validate.md` |

Stage 4 — actually generating tests — is not part of this harness. Point this
project's test-generation agent at the `specs/<ticket>.plan.md` file Stage 3
produces.

## Playwright MCP setup

This harness's explore and validate stages need browser access via Playwright
MCP. If it isn't already registered, add it once:

```
codex mcp add playwright -- npx @playwright/mcp@latest --isolated --caps=core --snapshot-mode=full --timeout-action=30000 --timeout-navigation=30000 --timeout-settle=5000 --test-id-attribute=data-testid
```

This writes to your global `~/.codex/config.toml`, not a file in this repo —
there's nothing to commit for it.

See `qa-harness/README.md` for the full walkthrough.
