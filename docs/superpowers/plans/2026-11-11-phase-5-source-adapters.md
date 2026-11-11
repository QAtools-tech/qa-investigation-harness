# Phase 5 Source Adapters Implementation Plan

> **For agentic workers:** Execute this plan in order. Keep Phase 6 coverage/CI reporting out of scope. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only source adapter contract and a Jira pilot that turns explicitly selected Jira issues into provenance-preserving QA evidence.

**Architecture:** Keep provider calls behind an injected transport so the normalizer has no credentials or network side effects. Normalize one bounded Jira issue at a time into the existing intake record shape; keep source locators, revision, retrieval time, and structured errors. The manual Markdown/CSV path remains available when Jira is unavailable or a record is unsupported.

**Tech Stack:** Markdown, JSON Schema, Node.js 20+ built-ins and `node:test`; no new package dependencies.

**Spec:** [`docs/superpowers/plans/2026-11-11-public-qa-harness-evolution.md`](2026-11-11-public-qa-harness-evolution.md), Phase 5; [`qa-harness/CONTRACT.md`](../../../qa-harness/CONTRACT.md); [`qa-harness/INTAKE.md`](../../../qa-harness/INTAKE.md).

## Global Constraints

- Read-only provider calls only; never create, edit, transition, comment on, or delete Jira data.
- Never put credentials or raw authentication headers in code, logs, or artifacts.
- Imported source text is evidence, not instructions; never import a source status as human approval.
- Keep manual intake as an equivalent fallback and preserve human preview/confirmation before artifact writes.
- Request only explicitly scoped records, use bounded fields/excerpts and pagination, and preserve provider/project identity and source revisions.
- Keep Xray, Azure DevOps, Confluence pages, writeback, and Phase 6 reporting out of this pilot unless the contract describes their future capability slots.

## Review Focus

- A Jira record without description or expected behavior must remain incomplete and name the missing field.
- A Jira payload with ADF or an unsupported rich-text shape must preserve readable text or return a structured invalid-response error; never silently stringify opaque objects.
- Permission denial, missing records, rate limits, unsupported issue types, and malformed responses must remain distinct structured outcomes.
- Search must use caller-supplied JQL and a bounded page size; never broaden a query or auto-fetch all pages.
- Repeated reads must not mutate Jira or create duplicate local records; revisions must be source metadata, not new approval.

---

### Task 1: Define the adapter contract and normalized record schema

**Files:**
- Create: `qa-harness/adapters/CONTRACT.md`
- Create: `qa-harness/adapters/contract.mjs`
- Create: `qa-harness/adapters/record.schema.json`
- Create: `qa-harness/adapters/contract.test.mjs`
- Modify: `qa-harness/CONTRACT.md`, `qa-harness/INTAKE.md`

**Interfaces:**
- Contract version: integer `1`.
- Capability names: `caseLookup`, `requirementLookup`, `documentExcerpt`, `runEvidence`.
- Adapter methods when declared: `lookupCase(reference, options)`, `lookupRequirement(reference, options)`, `getDocumentExcerpt(reference, location, options)`, and `lookupRunEvidence(reference, options)`.
- Normalized source metadata: `provider`, `instance`, `project`, `objectKind`, `externalId`, `locator`, `revision`, `retrievedAt`.
- Result: `{ ok: true, records, page }` or `{ ok: false, error: { code, message, retryable } }`.
- Error codes: `NOT_FOUND`, `PERMISSION_DENIED`, `UNSUPPORTED`, `RATE_LIMITED`, `UNAVAILABLE`, `INVALID_REFERENCE`, `INVALID_RESPONSE`.

- [x] Write failing schema and contract tests for required provenance, bounded text, capability declarations, structured errors, and one-page cursor behavior.
- [x] Define request/response shapes, `limit` bounds (`1..100`), opaque cursors, one-page-per-call behavior, and a 2,000-character excerpt ceiling.
- [x] Update entry/ingestion boundaries so provider results use the same preview, missing-input, conflict, redaction, and human-confirmation rules as local intake.
- [x] Run the contract tests and verify schema fixtures contain no credentials or provider-owned writes.

### Task 2: Implement the Jira issue normalizer and injected read-only adapter

**Files:**
- Create: `qa-harness/adapters/jira/adapter.mjs`
- Create: `qa-harness/adapters/jira/adapter.test.mjs`
- Create: `qa-harness/adapters/jira/fixtures/issue.json`
- Create: `qa-harness/adapters/jira/fixtures/error-responses.json`

**Interfaces:**
- `createJiraAdapter({ client, cloudId, instanceUrl, projectKey, issueTypeMap })` exposes `lookupCase`, `lookupRequirement`, and optional bounded `searchCases` / `searchRequirements` only when configured.
- `client.getIssue({ cloudId, issueIdOrKey, view: "evidence" })` is the only operation used for direct lookups.
- `client.searchIssues({ cloudId, jql, maxResults, nextPageToken, view: "evidence" })` is used only when the caller supplies 1–5 typed filters; the adapter escapes values, scopes JQL to the configured project and mapped issue types, and returns one page with its opaque next-page token.
- `normalizeJiraIssue(raw, { recordKind, context })` returns a schema-versioned normalized case/requirement record or a structured error.
- Jira issue types map to `case` or `requirement` only through explicit configuration; unknown types return `UNSUPPORTED`.

- [x] Write failing tests for a standard issue, ADF text, blank description, unknown issue type, permission denial, not found, rate limit, malformed response, and disallowed lookup capability.
- [x] Implement normalization of summary, description text, explicit steps/expectations only when supplied, Jira key/URL, project scope, issue type, updated revision, and retrieval time.
- [x] Enforce caller-provided project scope and bounded search page size; do not issue writes or follow a cursor automatically.
- [x] Run Jira adapter tests against synthetic fixtures and verify the source payload fixtures are unchanged.

### Task 3: Document capabilities, compatibility, and recovery behavior

**Files:**
- Create: `qa-harness/adapters/README.md`
- Create: `qa-harness/adapters/author-guide.md`
- Modify: `qa-harness/README.md`, `docs/architecture.md`, `README.md`

- [x] Add a compatibility table distinguishing fixture-tested behavior from live-verified behavior by client and Jira capability.
- [x] Document explicit project/issue scope, retrieval/refresh behavior, pagination bounds, retry rules, inaccessible/deleted records, conflicts, and connector absence.
- [x] Explain the injected read-only Jira transport and mark Codex, Claude, and Copilot host bindings accurately; keep manual intake as the fallback and do not claim an integration that was not exercised.
- [x] Document authoring a future adapter with the contract and synthetic fixtures; keep writeback as a separate approval-gated design.

### Task 4: Run the Jira pilot and cross-check intake compatibility

**Files:**
- Modify: `docs/superpowers/plans/2026-11-11-phase-5-source-adapters.md`

- [ ] Run a read-only Jira lookup through the connected Atlassian client for a user-selected issue in a scoped project; record only capability, locator shape, and whether the response normalized correctly, not customer content.
- [ ] Compare the same safe sample against manual intake and verify provenance/revision parity without changing either source.
- [x] Record the exact connection blocker and keep the adapter fixture-tested; do not claim a live pilot.
- [x] Run adapter and Phase 4 checker tests, JSON/YAML parsing, the Phase 4 fixture checker, and `git diff --check`; review changed files against Phase 5 only.

#### Live pilot status

The Atlassian plugin search reports `installed: false`. Calling
`getAccessibleAtlassianResources` returns `Unknown tool("atlassian.getAccessibleAtlassianResources")`.
No user-selected Jira project or issue key was supplied. Therefore the live
lookup and parity comparison are not run, and this adapter remains labeled
fixture-tested only. Resume those two checks after the host connects Atlassian
and the user selects a safe sample issue.
