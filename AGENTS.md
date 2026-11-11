# QA Investigation Harness

Use [investigation contract](qa-harness/CONTRACT.md) pick entry point: ticket, local case, spec, or run.

Repo got risk-driven QA investigation harness. Full rules in `qa-harness/RULES.md` — read whole thing before run any stage below, follow exact. Read matching stage file under `qa-harness/stages/` before act on stage; no rely on summary or memory of it.

No write Playwright test code self. Test gen belongs project's test-gen agent — see `qa-harness/RULES.md` for get one if missing (`npx playwright init-agents --loop=codex` set one up for this tool). Harness only investigate, make human-reviewed test plan, audit result.

## Running a stage

No slash command here — user ask run stage, read `qa-harness/RULES.md` plus matching file below, follow exact, use whatever ticket ID, test case, or slug user gave in message. Ask for anything stage file need but not given.

| User asks for | Read |
|---|---|
| "status" / "resume" / "continue QA" | `qa-harness/stages/00-status-and-resume.md` |
| "explore" / Stage 1 | `qa-harness/stages/01-explore.md` |
| "model" / Stage 2 | `qa-harness/stages/02-model.md` |
| "challenge" / Stage 3 | `qa-harness/stages/03-challenge.md` |
| "validate" / Stage 5 | `qa-harness/stages/05-validate.md` |

Stage 4 — gen tests — not part harness. Point project's test-gen agent at `specs/<ticket>.plan.md` file Stage 3 makes.

For read-only progress report, ask "status <investigation-id>". To continue next eligible action, ask "resume <investigation-id>". Read `qa-harness/RULES.md` and `qa-harness/stages/00-status-and-resume.md` first. Status never write; resume follow shared resolver, stop at human approval and generator handoff boundary.

## Playwright MCP setup

Harness's explore and validate stages need browser access via Playwright MCP. If not registered yet, add once:

```
codex mcp add playwright -- npx @playwright/mcp@latest --isolated --caps=core --snapshot-mode=full --timeout-action=30000 --timeout-navigation=30000 --timeout-settle=5000 --test-id-attribute=data-testid
```

Write to global `~/.codex/config.toml`, not repo file — nothing commit for it.

See `qa-harness/README.md` for full walkthrough.