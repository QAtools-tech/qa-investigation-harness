# Phase 7: Public Release Verification Design

## Goal

Prove that a new user can follow the public QA harness materials from a fresh checkout for both a CSV case and a supplied spec plus failed run, while keeping release claims within the evidence actually exercised.

## Current state

The repository already has narrative examples for both journeys, a CSV fixture, a plan fixture, reviewer blocker fixtures, an offline Playwright JSON fixture, a Node.js built-in test suite, and thin adapters for Codex, Claude Code, and GitHub Copilot. The contributor guide still says there is no automated test suite, there is no compatibility matrix or migration guide, and the examples do not yet provide a reproducible first-run script with expected stops and outputs. Live Jira binding and a consuming-project generator run are not available in this environment.

## Approach

Run a release rehearsal from a clean checkout using two self-contained public walkthroughs. A fresh agent that did not build Phase 7 will follow each walkthrough and record first-attempt outcomes. Fix any harness or documentation defects exposed by the rehearsal, then update the supported-client matrix, migration guide, contributor guide, and entry-point README. Treat the fresh agent as an independent agent check, not human adoption evidence. Do not claim live provider, browser, or generator verification where those were not exercised.

## Walkthroughs

1. **CSV case to approved handoff:** choose the intake entry point; preview the CSV row; name its missing expected result; record a supplied clarification; follow evidence through exploration/model/risk review; pause for explicit human approval; show the plan handoff only after fresh approval. Include a separate resume step and a changed-oracle case that must stop before export.
2. **Existing spec plus failed run:** choose standalone triage from run evidence; use the synthetic Playwright JSON fixture and plan; produce a report showing failure evidence, missing test-source evidence, unresolved mappings, and provenance limits; demonstrate that an approved-risk audit stops when approval or mapping is absent.

Use synthetic, repository-owned fixtures only. No production URL, credentials, provider data, or generated Playwright test code is added. The first walkthrough's real browser exploration and generator execution remain explicitly optional external steps when no consuming project/environment is supplied.

## Public materials

- `qa-harness/walkthroughs/csv-case-to-approved-handoff.md` and `qa-harness/walkthroughs/spec-and-failed-run.md`: prerequisites, exact user prompts/commands, expected outputs, pause/resume points, and evidence limits.
- `docs/compatibility.md`: client entry points, requirements, manual/optional capabilities, fixture coverage, and live-verification status for Codex, Claude Code, GitHub Copilot, Jira, Xray, Confluence, and Azure DevOps. Distinguish documented configuration from exercised runtime behavior.
- `docs/migration.md`: move legacy ticket-key artifact folders to local investigation IDs without losing history, mappings, or approval provenance; explain unsupported inference and rollback by preserving the original folder.
- `CONTRIBUTING.md`: current built-in Node.js checks, secret/link audit, fixture policy, and review steps.
- `README.md` and `qa-harness/README.md`: link the two walkthroughs and compatibility/migration guidance; remove stale claims.
- Add a dependency-free local Markdown link checker to the existing Node test suite. Verify walkthrough behavior, required stop points, and the truth of compatibility claims through the independent agent rehearsal and final evidence review rather than brittle text-matching tests.

## Acceptance

- Both walkthroughs are attempted from a fresh checkout by an agent who did not build the changes; each result records the first attempt, blockers, corrections, and whether the documented expected stop occurred.
- CSV intake selects the correct entry point, names the missing expected result, and stops before export when approval is missing or stale.
- The supplied spec/run selects triage, preserves the failure as observed evidence, and exposes missing test source, unresolved mappings, and provenance limits without inventing approval or root cause.
- The fixture and complete Node.js test suites pass; docs links resolve; the security scan finds no embedded secrets; legacy artifact fixtures remain accepted by existing checks.
- Compatibility and release statements label each surface as documented, fixture-tested, or live-verified. Real-human adoption, browser exploration, consuming-project generation, and live Jira remain unverified unless separately exercised.

## Non-goals

No publication/tagging, new provider transport, credential setup, generated test code, production access, or claim of human first-run reliability. Phase 7 verifies repository materials and documented local behavior; release publication remains a separate maintainer action.

## Design decisions

- Use the existing Node.js built-in test suite and synthetic fixtures; add no dependency or test-runner package.
- Keep workflow behavior in shared stage and contract files; walkthroughs link to those sources rather than copy methodology.
- Use the new phase branch based on the pushed Phase 6 commit so the release rehearsal includes its report capability; this makes Phase 7 a stacked branch until Phase 6 merges.
