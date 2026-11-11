# QA Investigation Harness — multi-tool

A risk-driven investigation layer that sits in front of your project's
Playwright test-generation agent, whichever AI coding tool you use. It never
writes test code itself: it walks a flow, surfaces risks for a human to
approve or reject, and only then produces a plan file for your actual
generator to build from — plus an after-the-fact audit of what got generated.

```
[Ticket ID + test case] → explore → model → challenge (Part A: risk table)
                                            ↓
                              [HUMAN edits risks.md — APPROVE/REJECT]
                                            ↓
                    challenge (Part B) → specs/<ticket>.plan.md
                                            ↓
              [HUMAN points their test-generation agent at that file]
                                            ↓
                                       validate
```

## One source of truth, thin adapters

Use the [investigation contract](CONTRACT.md) to choose a stage based on the
evidence you already have. See the [public examples](examples.md) for a CSV
case and a direct review of an existing spec and failed run.

- **[RULES.md](RULES.md)** — the hard rules every stage follows, regardless
  of tool
- **[stages/](stages/)** — the four stages themselves (`01-explore.md`,
  `02-model.md`, `03-challenge.md`, `05-validate.md`), written as plain
  instructions any capable coding agent can read and follow directly

Every tool-specific file below is a thin wrapper: it just tells the agent
which stage file to read and what arguments to fill in. If the methodology
ever needs to change, it changes once, here — not once per tool.

## Pick your tool

### GitHub Copilot (VS Code)

Already set up — see the root [README.md](../README.md), `.github/copilot-instructions.md`,
`.github/prompts/qa-*.prompt.md`, and `.vscode/mcp.json`. That version predates
this multi-tool layer and is self-contained; you don't need anything in this
folder to use it.

### Claude Code

- `CLAUDE.md` (repo root) points here automatically
- Stages are skills: `/qa-explore`, `/qa-model`, `/qa-challenge`, `/qa-validate`
- Playwright MCP is registered in `.mcp.json` (repo root) — no setup needed

Example:
```
/qa-explore PROJ-1234 "Verify user can filter the Task List by status"
/qa-model PROJ-1234
/qa-challenge PROJ-1234
  ↓ edit qa-artifacts/PROJ-1234/risks.md by hand ↓
/qa-challenge PROJ-1234 "run Part B"
```

If you don't already have a test-generation agent for Claude Code, get one
with `npx playwright init-agents --loop=claude`, then point it at
`specs/PROJ-1234.plan.md`.

### Codex

- `AGENTS.md` (repo root) is read automatically and explains how to run a
  stage — there's no slash command; just ask in plain language, e.g. "run the
  qa-explore stage for PROJ-1234: verify user can filter the task list by
  status"
- Playwright MCP needs a one-time setup command — see `AGENTS.md` for the
  exact `codex mcp add` invocation

If you don't already have a test-generation agent for Codex, get one with
`npx playwright init-agents --loop=codex`, then point it at
`specs/PROJ-1234.plan.md`.

### Cursor

Not set up yet. Playwright's official agent generator
(`npx playwright init-agents`) doesn't have a Cursor target, so there's no
drop-in test-generation agent to hand a plan off to — the hand-off step this
harness relies on doesn't have anywhere to go for Cursor yet. Revisit this
once that changes, or adapt the `claude` or `codex` output by hand if you
need it sooner.

## Why no planner agent, on any tool

If your test-generation agent came with a paired planner (Playwright's
`init-agents` produces one), it's intentionally not part of this workflow.
See **Relationship to your project's planner/generator agents** in
[RULES.md](RULES.md) for why — short version: a planner explores and decides
what to test on its own, with no mechanism to defer to a human-approved risk
table, which would silently undermine the whole point of this harness.

## Artifacts

Identical across every tool, because they're all following the same stage
files:

```
qa-artifacts/<ticket>/
  exploration.md   ← Stage 1
  flow-model.md    ← Stage 2
  risks.md         ← Stage 3A (you edit the table) + Generated mapping (appended by 3B)
  validation.md    ← Stage 5
specs/
  <ticket>.plan.md ← Stage 3B — hand this to your generator
```
