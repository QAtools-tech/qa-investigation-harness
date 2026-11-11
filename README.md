# QA Investigation Harness

> A risk-driven investigation layer for Playwright test generation.

![QA Investigation Harness workflow preview](docs/assets/qa-investigation-harness-social.svg)

The QA Investigation Harness turns a local case, spec, or run into an evidence-backed hand-off for a separate Playwright test-generation agent. It walks the real browser flow when needed, models observed states and transitions, puts risks in front of a human for approval, and produces a plan that can be audited after generation.

It is deliberately small and tool-agnostic: the methodology lives in shared instructions, while GitHub Copilot, Claude Code, and Codex use thin adapters around it.

## Why it exists

Test generation is more useful when it starts from what the application actually did and from risks a human has consciously chosen to cover. This harness adds that investigation layer before generation without taking ownership of test code.

The result is a traceable chain:

```text
investigation ID + case, spec, or run
        │
        ▼
  status / resume ──► the stage supported by available evidence
                             │
                             ▼
  browser exploration ──► state/transition model ──► proposed risks
                                                              │
                                                human approves/rejects
                                                              │
                                                              ▼
                                                     generator plan
                                                              │
                                                              ▼
                                                   oracle validation
```

## Core capabilities

- **Snapshot-based exploration** — records the live flow, accessibility-tree elements, URLs, visible changes, and evidence gaps.
- **State and transition modeling** — separates observed transitions from plausible transitions that were not walked.
- **Human-gated risk review** — generates proposed risks; only the human marks them approved or rejected.
- **Generator-compatible output** — writes `specs/<id>.plan.md` in a plain plan structure a test-generation agent can consume.
- **Post-generation auditing** — checks generated assertions against approved oracles and can mutation-check assertion strength.
- **Read-only status and resume** — reports completed work, blockers, missing evidence, and one next action from artifacts on disk; resume follows the same resolver.

## How the workflow works

```mermaid
flowchart LR
    A[Investigation ID + case, spec, or run] --> R[Status / resume resolver]
    R -->|status| S[Read-only progress report]
    R -->|resume| B[Evidence-qualified next action]
    B --> C[Observations and flow model]
    C --> D[Proposed risks]
    D --> E{Human reviews risks.md}
    E -->|Fresh approval| F[Stage 3B: write plan]
    F --> G[External test-generation agent]
    G --> H[Stage 5: qa-validate]
    H --> I[validation.md]
```

Ask for `status <investigation-id>` to inspect progress without changing files, or `resume <investigation-id>` to continue from the next eligible action. The human approval and generator handoff remain explicit stops. The harness never silently decides which risks matter, and it never writes Playwright test code or seed files.

For the deeper artifact contract and boundaries, see [Architecture](docs/architecture.md).

## Stage outputs

Each flow is identified by an existing ticket ID or a local investigation ID:

| Stage | Input | Output |
| --- | --- | --- |
| Status | Investigation ID and available artifacts | Read-only status report |
| Resume | Investigation ID and evidence for the next eligible action | Existing stage output or a named blocker |
| Explore | Investigation ID, scoped case, confirmed non-production URL, interactive test account | `qa-artifacts/<id>/exploration.md` |
| Model | Exploration artifact or qualifying imported observations | `qa-artifacts/<id>/flow-model.md` |
| Challenge Part A | Flow model and cited observations | `qa-artifacts/<id>/risks.md` with `PROPOSED` rows |
| Human review | Risk table | `APPROVED` / `REJECTED` statuses entered by the human only |
| Challenge Part B | Fresh approved risks, dependencies, usable steps | `specs/<id>.plan.md` plus generated mapping in `risks.md` |
| External generator | The plan file and the consuming project's test setup | Generated test files in that project |
| Validate | Expected behavior plus test source or run evidence | `qa-artifacts/<id>/validation.md` |

The `qa-artifacts/` and `specs/` directories are generated workflow output and are intentionally ignored by default. This repository documents and validates the process; it does not publish real investigation findings.

## Tool adapters

The shared methodology lives in [`qa-harness/`](qa-harness/):

- [`RULES.md`](qa-harness/RULES.md) is the source of truth for hard rules, safety boundaries, artifact paths, and stage order.
- [`stages/`](qa-harness/stages/) contains the status/resume resolver and tool-agnostic stage instructions.
- [`.github/prompts/`](.github/prompts/) provides GitHub Copilot prompt adapters.
- [`.claude/skills/`](.claude/skills/) provides Claude Code skill adapters.
- [`AGENTS.md`](AGENTS.md) provides Codex instructions.
- [`CLAUDE.md`](CLAUDE.md) provides Claude Code repository instructions.

Playwright MCP configuration is kept per tool:

- [`.mcp.json`](.mcp.json) is the repository-level MCP configuration used by Claude Code.
- [`.vscode/mcp.json`](.vscode/mcp.json) is the VS Code configuration used by the Copilot setup.
- Codex users can register the server once with the command shown below.

## Getting started

This repository has no application runtime, package manifest, dependency install, Docker image, database, or built-in test suite. There is nothing to build before reading or adapting the harness.

### 1. Clone the repository

```bash
git clone https://github.com/Yasser132456/qa-investigation-harness.git
cd qa-investigation-harness
```

### 2. Choose an adapter

#### GitHub Copilot in VS Code

Open the repository in VS Code. Use `.github/prompts/qa.prompt.md` with action `status` or `resume` for progress and continuation. Other prompt adapters and `.vscode/mcp.json` provide direct stage access.

#### Claude Code

Open the repository with Claude Code. `/qa status <id>` and `/qa resume <id>` inspect or continue an investigation; the `qa-*` skills keep direct stage access. The root `.mcp.json` registers Playwright MCP.

#### Codex

Register Playwright MCP once in the global Codex configuration:

```bash
codex mcp add playwright -- npx @playwright/mcp@latest --isolated --caps=core --snapshot-mode=full --timeout-action=30000 --timeout-navigation=30000 --timeout-settle=5000 --test-id-attribute=data-testid
```

Then ask Codex for `status <investigation-id>` or `resume <investigation-id>`, or run a stage by name for a focused rerun. The full flow and safety rules are in [`AGENTS.md`](AGENTS.md).

### 3. Run the stages in order

Use `status <investigation-id>` for a read-only progress report or `resume <investigation-id>` to continue from the next eligible action. The stage names are the same across adapters:

1. Start from the available case, spec, or run evidence; status/resume selects the supported entry point.
2. `qa-explore` — when observation is needed, provide a scoped case; confirm a non-production URL and provide credentials interactively.
3. `qa-model` — build the state/transition model from observations.
4. `qa-challenge` — propose risks, then stop for human review.
5. The human records decisions in `qa-artifacts/<id>/risks.md`.
6. Run `qa-challenge` Part B to create the generator plan.
7. Point the consuming project's test-generation agent at `specs/<id>.plan.md`.
8. Run `qa-validate` when generated test source or run evidence is available.

### Environment and credentials

The harness requires a non-production target URL and an interactive test account for browser exploration. Credentials are never written to repository files, artifacts, plans, or logs. The confirmed non-production URL may be recorded in the exploration/plan artifacts because the generator needs to know which environment the flow describes.

## What this repository intentionally does not do

- It does not create, edit, or suggest Playwright test code.
- It does not create seed files.
- It does not invent ticket IDs or test cases.
- It does not run against production environments.
- It does not mark risks approved or rejected for the human.
- It does not replace the consuming project's test-generation agent.
- It does not claim API, database, email, background-job, or persisted-state evidence is browser-observable when it is not.

## Repository structure

```text
.
├── .claude/skills/              # Claude Code status, resume, and stage adapters
├── .github/prompts/             # GitHub Copilot status, resume, and stage adapters
├── .vscode/mcp.json             # VS Code Playwright MCP configuration
├── docs/
│   ├── architecture.md          # Detailed workflow and artifact boundaries
│   └── assets/                  # Repository mark and social-preview artwork
├── qa-harness/
│   ├── RULES.md                 # Shared rules and artifact contract
│   ├── README.md                # Multi-tool usage guide
│   └── stages/                  # Status/resume, explore, model, challenge, validate
├── AGENTS.md                    # Codex repository instructions
├── CLAUDE.md                    # Claude Code repository instructions
├── CONTRIBUTING.md              # Contribution workflow
├── SECURITY.md                  # Security reporting and secret handling
└── README.md
```

## Engineering decisions

### One source of truth, thin adapters

Rules and stage behavior are centralized in `qa-harness/`. Tool-specific files only provide the invocation shape and arguments for their host environment. This keeps methodology changes consistent across adapters.

### Evidence before recommendation

Stage 1 records observations only. Stage 2 models what was observed and what was not. Stage 3 proposes risks without approving them. Keeping these responsibilities separate makes the human review boundary visible and preserves traceability.

### Real oracles, even when the browser cannot verify them

The harness names the oracle that would actually prove a risk, including API or database checks that are not currently wired into the consuming test project. It records that gap instead of replacing the oracle with a weaker rendered-text assertion.

## Development and contribution

Changes to shared rules affect every adapter, so start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and read [`qa-harness/RULES.md`](qa-harness/RULES.md) before editing stage instructions. Security concerns and accidentally exposed credentials belong in [`SECURITY.md`](SECURITY.md).

## Roadmap and known limits

The current repository is intentionally focused on the investigation layer. Potential future work includes additional tool adapters, automated documentation checks, and optional API/database oracle integrations for consuming projects. None of these are implemented here today.

## License

This project is available under the [MIT License](LICENSE).

## GitHub metadata recommendations

The available repository connector can inspect GitHub metadata but cannot update the repository description, topics, or social-preview setting from this environment. Recommended values:

- **Description:** Risk-driven browser-flow investigation and human-reviewed test plans for Playwright test generation.
- **Topics:** `playwright`, `test-automation`, `qa-engineering`, `software-testing`, `browser-automation`, `risk-based-testing`, `test-planning`, `developer-tools`, `llm-agents`, `claude-code`, `github-copilot`.
- **Social preview asset:** [`docs/assets/qa-investigation-harness-social.svg`](docs/assets/qa-investigation-harness-social.svg), upload manually under GitHub repository settings → Social preview.
- **Homepage/demo URL:** None verified; leave unset until a live documentation or demo site exists.
