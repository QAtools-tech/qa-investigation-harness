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
evidence you already have. See the [public examples](examples.md) and
[synthetic intake fixtures](fixtures/README.md) for CSV intake and direct
review examples.

- **[INTAKE.md](INTAKE.md)** — local source, provenance, preview, and revision rules
- **[stages/intake.md](stages/intake.md)** — preview/confirm/write workflow
- **[stages/review-plan.md](stages/review-plan.md)** — direct read-only plan review
- **[checks/README.md](checks/README.md)** — deterministic artifact checker, manual command, optional hook, and CI scope
- **[adapters/README.md](adapters/README.md)** — optional read-only source adapters and Jira pilot compatibility

Use `status <investigation-id>` for a read-only progress report or
`resume <investigation-id>` to continue from the next eligible action. Both
use [the shared resolver](stages/00-status-and-resume.md), which reads the
artifacts on disk, names blockers and missing evidence, and preserves the
human approval and generator handoff stops.

- **[RULES.md](RULES.md)** — the hard rules every stage follows, regardless
  of tool
- **[stages/](stages/)** — shared status/resume resolver, intake and plan review,
  and investigation stages (`00-status-and-resume.md`, `intake.md`,
  `review-plan.md`, `01-explore.md`,
  `02-model.md`, `03-challenge.md`, `05-validate.md`), written as plain
  instructions any capable coding agent can read and follow directly

Every tool-specific file below is a thin wrapper: it just tells the agent
which stage file to read and what arguments to fill in. If the methodology
ever needs to change, it changes once, here — not once per tool.

## Pick your tool

Each supported tool exposes status/resume, intake, plan review, and direct
stage entry points. Use the capability table to choose a reviewer and check
path that the host can enforce.

| Capability | Claude Code | GitHub Copilot | Codex |
|---|---|---|---|
| Stage entry | `/qa-*` skills | `.github/prompts/qa-*.prompt.md` | `$qa-*` skills or plain-language fallback |
| Focused reviewer | Custom agent restricted to Read/Grep/Glob | Custom agent restricted to read/search | Review skill; instructions do not enforce a tool allowlist |
| Local automatic check in this repo | Manual CLI | Manual CLI | Opt-in Codex `PostToolUse` example |
| Manual check and CI | `node qa-harness/checks/qa-check.mjs` | Same command | Same command |
| Optional source adapter | Requires a host read-only client binding; see `adapters/` | Requires a host read-only client binding; see `adapters/` | Requires a host read-only client binding; see `adapters/` |

### GitHub Copilot (VS Code)

Use `.github/prompts/qa.prompt.md` for status or resume,
`qa-intake.prompt.md` for intake, `qa-review-plan.prompt.md` for plan review,
and the other `qa-*.prompt.md` files for direct stages. These are thin
adapters to the shared rules and stage files. The root [README.md](../README.md), `.github/copilot-instructions.md`,
and `.vscode/mcp.json` cover the setup.
Focused reviewer agents are in `.github/agents/` and use only read/search
tools. The artifact checker remains manual in this adapter.

### Claude Code

- `CLAUDE.md` (repo root) points here automatically
- `/qa status <id>` reports progress; `/qa resume <id>` continues from the next eligible action
- Stages are skills: `/qa-intake`, `/qa-review-plan`, `/qa-explore`, `/qa-model`, `/qa-challenge`, `/qa-validate`
- Playwright MCP is registered in `.mcp.json` (repo root) — no setup needed
- `qa-risk-challenger` and `qa-validation-reviewer` are read-only custom agents

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

- `AGENTS.md` (repo root) is read automatically; project skills provide
  `$qa-intake`, `$qa-review-plan`, `$qa-status-resume`, `$qa-explore`,
  `$qa-model`, `$qa-challenge`, and `$qa-validate`
- Plain-language requests are the manual fallback when skills are unavailable
- `$qa-risk-review` and `$qa-validation-review` are read-only by instruction;
  Codex skills do not enforce tool restrictions
- Copy `qa-harness/hooks/codex-hooks.example.json` to `.codex/hooks.json` to
  opt into the local hook, then review/trust it with `/hooks`
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
