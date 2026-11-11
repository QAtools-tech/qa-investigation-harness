# Phase 4 Client Skills, Hooks, and Reviewers Implementation Plan

> **For agentic workers:** Execute this plan in order. Keep Phase 5 source adapters out of scope.

**Goal:** Make Phase 4 workflows usable through Claude Code, Copilot, and Codex, with a repeatable artifact checker, optional hook/CI execution, and focused evidence-only review roles.

**Architecture:** Shared stage instructions remain canonical. Thin client adapters pass arguments to those instructions. A dependency-free Node checker validates artifact invariants; manual CLI, opt-in Codex post-tool hook, and GitHub Actions call the same checker. Reviewer roles read bounded artifacts and return findings; only the parent workflow and human make changes or decisions.

**Tech Stack:** Markdown, JSON, Node.js 20+ built-ins (`node:test`), GitHub Actions. No npm dependencies.

**Scope source:** Phase 4 roadmap requirements from the user-provided evolution plan, applied to the squashed Phase 3 baseline.

## Global Constraints

- No Phase 5 tracker/source adapters or provider connectors.
- Never generate or edit Playwright test code.
- Never approve/reject a risk, write a plan, or modify an artifact from a reviewer role.
- Reviewer output must cite evidence locators; parent reconciles findings and human owns decisions.
- Hooks stay opt-in, run only local deterministic checks, and are not a correctness boundary.
- Keep manual checker invocation available when hooks or CI are unavailable.
- Codex local skills instruct read-only behavior but do not enforce tool allowlists; document this limit.

## Review Focus

- Missing or malformed artifact files must produce useful diagnostics without crashing or changing files.
- Missing approval, stale approval, and an unresolved mapping must remain blockers; checker/reviewer must never convert them into approval or export.
- Weak or absent assertions must be reported with cited plan/mapping/test locations; reviewers must not edit or author tests.
- Malformed hook input, missing Node, and absent `qa-artifacts/` must fail safely or no-op with a clear diagnostic; manual checks must still work.
- Client capabilities differ; docs must not imply that role instructions enforce read-only access where the host lacks a tool allowlist.

---

### Task 1: Add Codex skills and align all client entry points

**Files:**
- Create: `.agents/skills/qa-intake/SKILL.md`
- Create: `.agents/skills/qa-review-plan/SKILL.md`
- Create: `.agents/skills/qa-status-resume/SKILL.md`
- Create: `.agents/skills/qa-explore/SKILL.md`
- Create: `.agents/skills/qa-model/SKILL.md`
- Create: `.agents/skills/qa-challenge/SKILL.md`
- Create: `.agents/skills/qa-validate/SKILL.md`
- Verify: `.claude/skills/qa*/SKILL.md` routes to shared instructions; modify `.github/prompts/qa*.prompt.md` only where needed
- Modify: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`
- Modify: `qa-harness/README.md`, root `README.md`

- [x] Give every skill/prompt explicit inputs and references to shared rules, contract, and stage instructions; remove duplicate methodology and unnecessary tools.
- [x] Preserve direct stage invocations and status/resume; add a client capability matrix and manual fallback.
- [x] Verify each adapter names an existing canonical instruction and retains its required input bindings.

### Task 2: Build artifact checker test-first

**Files:**
- Create: `qa-harness/checks/qa-check.mjs`
- Create: `qa-harness/checks/qa-check.test.mjs`
- Create: `qa-harness/fixtures/checks/` with a valid synthetic artifact; invalid cases are generated in isolated temporary roots by tests

- [x] Write tests for valid intake/risk artifacts, malformed IDs/sections, duplicate risk IDs, invalid status values, unresolved generated mappings, missing plan TC IDs, and no-artifacts behavior; run and observe expected failures.
- [x] Implement deterministic, read-only diagnostics with file and line locations; support a repository root argument and CLI invocation.
- [x] Run focused tests and the complete checker test suite; confirm it never repairs artifacts or changes approval state.

### Task 3: Wire an opt-in hook and CI to the same checker

**Files:**
- Create: `qa-harness/checks/qa-check-hook.mjs`
- Create: `qa-harness/hooks/codex-hooks.example.json`
- Create: `.github/workflows/qa-harness-check.yml`
- Modify: `qa-harness/checks/qa-check.test.mjs`
- Modify: `qa-harness/README.md`, `README.md`

- [x] Add a Codex `PostToolUse` example that checks artifacts after `apply_patch`; keep it outside auto-loaded hook locations until the user opts in.
- [x] Test valid, invalid, and malformed event payloads; ensure hook output is actionable and compatible with Codex event output.
- [x] Add a CI job that runs the same `qa-check.mjs` command and Node tests against synthetic fixtures.
- [x] Document event scope, trust review, Node prerequisite, manual command, limitations, and removal/disable path.

### Task 4: Add focused risk challenger and validation reviewer roles

**Files:**
- Create: `qa-harness/stages/risk-reviewer.md`
- Create: `qa-harness/stages/validation-reviewer.md`
- Create: `.claude/agents/qa-risk-challenger.md`
- Create: `.claude/agents/qa-validation-reviewer.md`
- Create: `.github/agents/qa-risk-challenger.agent.md`
- Create: `.github/agents/qa-validation-reviewer.agent.md`
- Create: `.agents/skills/qa-risk-review/SKILL.md`
- Create: `.agents/skills/qa-validation-review/SKILL.md`
- Modify: `qa-harness/RULES.md`, `qa-harness/README.md`, `docs/architecture.md`

- [x] Define bounded required inputs, read-only findings, source locators, output shape, and missing/stale approval stops in shared reviewer instructions.
- [x] Restrict Claude/Copilot agent tools to read/search only; provide Codex skill-based review with explicit capability caveat.
- [x] Add synthetic examples for a risk candidate, missing approval, and weak assertion; walk through expected evidence-only findings without editing, approving, exporting, or writing tests.

### Task 5: Cross-client verification and final review

- [x] Run tests and checker from a clean checkout-like fixture root.
- [x] Validate all JSON examples, workflow YAML, skill/prompt target links, stage coverage, and hook event sample.
- [x] Compare cross-client invocation arguments and reviewer input/output contracts; leave unrelated planning drafts untouched.
- [x] Review the full branch diff against Phase 4 scope; record that custom-agent/skill discovery and host-enforced tool restrictions still require a live session in each client.
