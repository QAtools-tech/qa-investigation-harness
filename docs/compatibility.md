# Compatibility and verification status

The [project installer](../README.md#install-the-harness-into-another-project) places the shared harness and ten skill entry points in a consuming project. Claude Code uses `.claude/skills/`, Codex uses `.agents/skills/`, and GitHub Copilot uses `.github/skills/`. The published npm `latest` install and bundled artifact checker passed for all three targets. Installed intake reached the preview and human-confirmation boundary in Claude Code and VS Code Copilot. Codex workflow execution and the full Visual Studio IDE remain unverified.

The unreleased installer upgrade command tracks managed file hashes and updates files that still match their previous upstream version. Locally changed or untracked collisions are kept in place, with the incoming version saved under `.qa-investigation-harness/conflicts/<version>/`; users can review and resolve a conflict, then pass `--accept-local <path>` to adopt the resolved file as the next baseline. Upstream-removed files are preserved and reported for manual review. Files under `qa-artifacts/` are outside installer scope. These behaviors are fixture-tested and packed-smoke-tested; the published `0.1.0` package supports install only, so upgrade requires a later package release.

This page describes the files in this repository and what has actually been
verified. Repository adapters are instructions and fixtures; their presence
does not prove a host loads them or follows them. Installer and workflow smoke
evidence below was checked on 2026-11-13; upstream client requirements must be
rechecked after client updates.

## Evidence labels

- **Documented** — the repository has setup and invocation instructions.
- **Fixture-tested** — deterministic tests exercise the repository adapter or
  behavior with synthetic inputs.
- **Live-verified** — the host was connected to a scoped live account and the
  capability was exercised. No external provider/client integration below is
  marked live-verified.

## AI client and harness entry points

| Client/harness | Repository entry points | Requirements and capability | Evidence and limits |
|---|---|---|---|
| Codex | `AGENTS.md`; `.agents/skills/qa-*`; optional `qa-harness/hooks/codex-hooks.example.json` | Node.js 20+ for the built-in checks and report tool. Browser stages require Playwright MCP; Codex users register it with the command in `AGENTS.md`. The hook is opt-in and runs after `apply_patch`; it is diagnostic, not a policy boundary. | Packed installation and bundled-checker execution passed for all ten skills. Runtime execution was blocked before skill execution by an expired local OAuth refresh token and an unsupported model for the tested ChatGPT account. Reviewer skills do not enforce read-only tool access. |
| Claude Code | `CLAUDE.md`; `.claude/skills/qa-*`; `.claude/agents/qa-*`; root `.mcp.json` | Browser stages require the configured Playwright MCP server. The checker/report tool uses Node.js 20+ and no package install. | Fresh install passed. The installed `qa-intake` skill produced the expected synthetic intake preview and stopped before writes for human confirmation. Artifact persistence was not verified. |
| VS Code **Local** harness | `.github/prompts/qa-*.prompt.md`; `.github/agents/*.agent.md`; `.vscode/mcp.json` | Prompt files use the `.github/prompts/` workspace location and are invoked in the Local harness. Playwright's VS Code agent generator currently documents VS Code 1.105 or newer. | Documented; static adapter and fixture tests pass. No fresh VS Code runtime adoption run was performed. The Local harness is deprecated and scheduled for removal in February 2027; check Microsoft's migration guidance before relying on it. |
| GitHub Copilot harness in VS Code | `.github/copilot-instructions.md`; `.github/agents/*.agent.md`; shared `AGENTS.md` guidance | Use plain-language start, status, and continue requests. The repository instructions point to the [shared guide](../qa-harness/GUIDED-CHAT.md). VS Code Local prompt files remain a separate entry point. | Fresh install and `qa-intake` skill resolution passed; the synthetic case reached an intake preview and human-confirmation question without writing artifacts. The case's Markdown list formatting made the expected-result line ambiguous in the preview, so that normalization detail needs a clearer-input rerun. Full Visual Studio, browser, and generator handoff remain unverified. |
| Cursor and other clients | No repository-native entry point | Use shared Markdown rules manually only if the client can read the repository. | Not set up or verified. |

Official client references checked for this matrix:
[Codex skills](https://developers.openai.com/plugins/concepts/skills),
[Claude Code skills](https://code.claude.com/docs/en/skills),
[VS Code custom instructions](https://code.visualstudio.com/docs/agents/reference/custom-instructions-reference),
[VS Code prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files),
[VS Code custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents),
[VS Code customization migration](https://code.visualstudio.com/docs/agent-customization/migrate-customizations),
and [Playwright test agents](https://playwright.dev/docs/test-agents).
Microsoft currently documents that prompt files run only in Local harness
sessions. Copilot harness sessions can use skills for reusable prompts. Local
is scheduled for removal in February 2027. Playwright's current test-agent guide lists
VS Code 1.105+ for that external agent experience. These statements describe
the linked upstream docs, not a runtime test of this repository's wrappers.

## Runtime tools and sources

| Capability | Evidence | Limit |
|---|---|---|
| Artifact structure checker | Fixture-tested; Node.js built-ins, Node.js 20+ | Structural diagnostics only; it does not decide freshness, approve risks, or repair files. |
| Offline Playwright JSON report | Fixture-tested; parser, coverage mapping, triage, and Markdown/JSON output | Does not run Playwright or inspect browser state. Run ID, target, and revision are supplied by the caller; omitted metadata remains unknown. See [report-tool instructions](../qa-harness/checks/README.md). |
| Jira issue lookup/search normalizer | Fixture-tested against synthetic Jira responses; contract accepts an injected read-only host client | No Jira transport is shipped or live-verified. A Jira token by itself is not consumed by this repository. The host owns authentication and must inject the bounded client described in [the Jira guide](../qa-harness/adapters/jira/README.md). |
| Xray Cloud cases/executions | Not implemented | Jira issue access does not establish Xray support or permissions. |
| Confluence pages | Not implemented | Jira issue descriptions are not treated as Confluence pages. |
| Azure Boards, Test Plans, and Pipelines | Not implemented | Separate adapter and scoped access would be required. |

The Jira reference follows the current
[Jira Cloud REST API v3 issue reference](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/).
It is not evidence that this repository can authenticate to or retrieve from a
tenant.

## Release evidence

The project’s full deterministic check command is:

```sh
node --test qa-harness/checks/*.test.mjs qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs
```

That command verifies fixtures and repository documentation checks. It does
not verify user discovery, client-specific runtime behavior, a live Jira
connection, a real browser exploration, or a consuming project's generator.
See the [Phase 7 verification report](release/phase-7-verification.md) for the
actual walkthrough attempts and remaining external checks.
