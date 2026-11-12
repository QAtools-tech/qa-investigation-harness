# Playwright Run Attachment Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add safe links from failed and flaky Playwright run-report entries to file-backed attachments inside the selected project root.

**Architecture:** Keep `parsePlaywrightReport` as the report-shape normalizer and preserve attachment path candidates only in its in-memory output. A new async path resolver canonicalizes candidates and removes unsafe raw paths before rendering; the report renderer emits a project-relative JSON path and a Markdown link relative to the selected Markdown output directory. Attachment bodies remain ignored.

**Tech Stack:** Node.js 20+, existing `node:test` suite, built-in `node:fs/promises` and `node:path`; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-12-playwright-run-attachment-links-design.md`

## Global Constraints

- Do not run Playwright or inspect, copy, upload, or render attachment contents.
- Emit a link only for an existing regular file whose canonical path is inside the selected project root.
- Never include attachment bodies, stdout, error payloads, or unsafe absolute attachment paths in generated reports.
- Preserve per-attempt association so retry artifacts remain distinguishable.
- Keep the report CLI offline and read-only except for its explicitly selected report outputs.
- Do not add dependencies or modify generated Playwright test code.
- Preserve the pre-existing unrelated modification to `qa-harness/adapters/jira/adapter.test.mjs`; do not stage it.

## Review Focus

- A body-only attachment contains arbitrary data — test that its body never reaches normalized or rendered output. (Task 1)
- An absolute or relative path escapes the selected root — test that the link is unavailable and no raw path is emitted. (Task 2)
- A lexically in-root path traverses a symlink to an outside file — test canonical containment blocks the link. (Task 2)
- A candidate path is missing or names a directory — test no link is emitted and report generation remains usable. (Task 2)
- An attachment name or path contains Markdown and URI metacharacters — test the rendered link stays valid and cannot alter report structure. (Task 3)

---

## File Structure

- `qa-harness/checks/playwright-json.mjs` — normalize attachment name, content type, attempt, and transient candidate path.
- `qa-harness/checks/playwright-json.test.mjs` — pin parser behavior and body omission.
- `qa-harness/fixtures/run-report/playwright-report.json` — synthetic file-backed and body-only attachment records.
- `qa-harness/checks/run-attachment-paths.mjs` — resolve candidate paths and return only safe project-relative metadata.
- `qa-harness/checks/run-attachment-paths.test.mjs` — cover containment, missing paths, regular files, and symlinks.
- `qa-harness/checks/qa-run-report.mjs` — resolve report attachments against the selected root and output directory.
- `qa-harness/checks/run-report-render.mjs` — include safe attachment metadata in JSON and links in Markdown; report schema version becomes `2`.
- `qa-harness/checks/run-report-render.test.mjs` — verify per-attempt rendering, path escaping, body exclusion, and schema version.
- `qa-harness/checks/qa-run-report.test.mjs` — verify CLI integration and output containment behavior.
- `qa-harness/checks/README.md`, `README.md`, `docs/architecture.md` — describe attachment links and their limits.

### Task 1: Normalize Playwright attachment metadata

**Files:**
- Modify: `qa-harness/checks/playwright-json.mjs`
- Modify: `qa-harness/checks/playwright-json.test.mjs`
- Modify: `qa-harness/fixtures/run-report/playwright-report.json`

**Interfaces:**
- Consumes: Playwright JSON `result.attachments` records with `name`, `contentType`, and optional `path` or `body`.
- Produces: Each normalized attempt has `attachments: [{ name, contentType, candidatePath }]`; string fields are bounded with the parser's existing `boundedString`, absent values become `null`, and `body` is never copied.

- [x] **Step 1: Write parser tests for per-attempt attachment metadata and ignored bodies**

In `playwright-json.test.mjs`, add a file-backed attachment to the failed retry in the fixture and assert the normalized attempt retains the name, content type, and candidate path. Assert the body-only `private` attachment has no body in the normalized object and the fixture's body marker remains absent from serialized normalized output. Assert attachments stay on their original retry when a test has multiple attempts.

- [x] **Step 2: Run the parser tests and confirm the new assertions fail**

Run: `node --test qa-harness/checks/playwright-json.test.mjs`
Expected: New attachment assertions fail because normalized attempts do not yet expose attachments.

- [x] **Step 3: Normalize attachment candidates in `parsePlaywrightReport`**

For every result attempt, map only valid attachment objects. Bound `name`, `contentType`, and string `path` using `boundedString`; use `null` for absent/non-string values. Store the path as `candidatePath` for the later resolver, and never read or copy `body`.

- [x] **Step 4: Re-run parser tests**

Run: `node --test qa-harness/checks/playwright-json.test.mjs`
Expected: All parser tests pass; normalized output contains metadata only and no attachment body.

### Task 2: Resolve and discard unsafe attachment paths

**Files:**
- Create: `qa-harness/checks/run-attachment-paths.mjs`
- Create: `qa-harness/checks/run-attachment-paths.test.mjs`

**Interfaces:**
- Consumes: A normalized run and a canonical project root.
- Produces: `resolveRunAttachmentPaths(run, projectRootReal) -> Promise<run>` with each attachment reduced to `{ name, contentType, path, availability }`. `path` is project-relative with `/` separators only when the candidate resolves to an existing regular file canonically inside the root; otherwise `path: null` and `availability: "unavailable"`. The returned run contains no `candidatePath`.

- [x] **Step 1: Write path-resolver tests**

Assert that a relative and an absolute in-root file become project-relative paths; a missing file, directory, relative traversal, absolute outside-root path, and non-string candidate become unavailable; and a directory junction/symlink inside the root that targets an outside file is unavailable. Assert unavailable results do not contain the candidate's raw path.

- [x] **Step 2: Run the resolver tests and confirm the missing module fails**

Run: `node --test qa-harness/checks/run-attachment-paths.test.mjs`
Expected: FAIL because the resolver module/export does not exist.

- [x] **Step 3: Implement `resolveRunAttachmentPaths`**

Clone the run/test/attempt/attachment records, resolve relative candidates under `projectRootReal`, resolve absolute candidates as supplied, call `realpath` and `stat`, and accept only regular files whose canonical paths pass the existing root-containment rule. Drop `candidatePath` in every result, including error and unavailable cases. Preserve the name/content type as bounded metadata.

- [x] **Step 4: Run the resolver tests**

Run: `node --test qa-harness/checks/run-attachment-paths.test.mjs`
Expected: All cases pass, including the canonical symlink escape case.

### Task 3: Render links and wire the report CLI

**Files:**
- Modify: `qa-harness/checks/qa-run-report.mjs`
- Modify: `qa-harness/checks/run-report-render.mjs`
- Modify: `qa-harness/checks/run-report-render.test.mjs`
- Modify: `qa-harness/checks/qa-run-report.test.mjs`
- Modify: `qa-harness/checks/README.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: The safe run returned by `resolveRunAttachmentPaths` and a Markdown attachment-link prefix derived from the report output directory to the selected project root.
- Produces: `renderRunReport(run, coverage, { attachmentLinkPrefix })` with JSON schema version `2`, safe project-relative attachment metadata, and Markdown links rendered beside the owning attempt. Unavailable attachments appear as unlinked metadata and never expose the original path.

- [x] **Step 1: Write renderer and CLI integration tests**

Assert JSON reports use schema version `2`, retain safe project-relative paths and attempt association, and omit `candidatePath` and body content. Assert Markdown links are relative from the selected Markdown output directory and escape a name/path containing spaces, parentheses, `#`, `?`, and `]`. Add a CLI test proving an outside-root attachment is unlinked while both report outputs are still written successfully.

- [x] **Step 2: Run the focused tests and confirm the new assertions fail**

Run: `node --test qa-harness/checks/run-report-render.test.mjs qa-harness/checks/qa-run-report.test.mjs`
Expected: New attachment assertions fail because outputs currently use schema version `1` and do not render attachments.

- [x] **Step 3: Wire safe attachment resolution into the report CLI**

In the normal run-report path, call `resolveRunAttachmentPaths(run, rootReal)` after loading the report. Do not add resolution to matrix rendering, which does not emit run-report attachments. Derive `attachmentLinkPrefix` from `path.dirname(outputPaths[1])` to `rootReal`, using `/` separators, and pass it to the renderer.

- [x] **Step 4: Render safe JSON metadata and Markdown links**

Update `renderRunReport` to accept `{ attachmentLinkPrefix = "" }`, increment its output `schemaVersion` to `2`, and preserve only safe attachment fields. Render a Markdown link only when `path` is present; encode each path segment for URI use and escape the visible name with existing `markdownText`. Show unavailable attachments without a URL.

- [x] **Step 5: Run focused report tests**

Run: `node --test qa-harness/checks/run-report-render.test.mjs qa-harness/checks/qa-run-report.test.mjs`
Expected: All renderer and CLI attachment tests pass; existing no-attachment report behavior remains valid apart from the documented schema version.

- [x] **Step 6: Update the run-report documentation**

Document that safe links point only to existing in-root files, are relative to the generated Markdown report, and do not copy/read attachment contents. Note JSON schema version `2`; retain the existing limits about no execution, no oracle verdict, and no root-cause inference.

- [x] **Step 7: Run the complete check suite and inspect the diff**

Run: `node --test qa-harness/checks/*.test.mjs`
Expected: All tests pass. Then run `git diff --check` and confirm only the listed implementation and documentation files changed (alongside the already-present design and plan documents).
