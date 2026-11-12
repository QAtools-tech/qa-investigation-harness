# Playwright run attachment links

## Intent

Help a QA user move from a failed or flaky test in the offline run report to the Playwright trace, screenshot, or other file attachment for that attempt. The report should carry safe links and enough metadata to identify them, without copying or inspecting attachment contents.

## Goals

- Preserve attachment name, content type, and retry/attempt association for normalized test results.
- Add clickable local links in Markdown and matching relative paths in JSON only when an attachment resolves to an existing regular file inside the selected project root.
- Keep attachment bodies, stdout, and error payloads out of normalized reports.
- Keep the workflow offline and read-only with respect to Playwright execution and attachment files.

## Non-goals

- Opening, parsing, copying, uploading, previewing, or summarizing traces, screenshots, videos, or other attachment contents.
- Inferring a failure cause, test quality, or oracle conformance from an attachment.
- Changing the external Playwright test-generation boundary.

## Approaches

1. **Safe metadata and links (selected).** Normalize file-backed attachment metadata, link only files proven to resolve inside the selected project root, and leave all attachment content untouched. This is the smallest path from triage to evidence and retains the repository's read-only, evidence-first boundary.
2. **Copy or preview attachment contents.** More convenient for a self-contained report, but copies potentially sensitive data, creates size and retention concerns, and adds format-specific handling that this offline harness does not need.
3. **Leave run reports unchanged.** Avoids code and data-handling changes, but leaves QAs to manually locate artifacts outside the failure timeline.

## Behavior

- Read attachment records from each Playwright result attempt and retain their name, content type, and file path reference; preserve which retry produced each attachment.
- Ignore attachment `body` values entirely. Body-only attachments remain unlinked and are not copied.
- Resolve file paths against the selected project root, canonicalize existing paths, and link only regular files contained by that root. Missing, invalid, or outside-root paths remain unlinked and are represented as unavailable metadata without exposing the original absolute path.
- Render attachment links beside their owning test attempt in Markdown. JSON carries the safe project-relative path and metadata. Link text and URI encoding must be safe for Markdown and path-special characters.
- Keep current behavior for reports with no attachments. Add the serialized attachment fields under a new run-report schema version so existing consumers can distinguish the extended shape.

## Constraints and safety

Playwright documents each attachment as a name and content type with an optional filesystem path or body. The body can contain arbitrary data, so this design never reads or emits it. A report can contain untrusted paths; canonical containment under the selected project root is required before a link is emitted. The original report remains read-only, and the CLI continues to write only its explicitly selected report outputs.

## Likely implementation surface

Update the Playwright JSON normalizer, run-report rendering, CLI path resolution, focused fixtures and tests, and the run-report/checker documentation. Do not change the traceability matrix, generator handoff, investigation artifacts, or adapter contracts.

## Decisions left to implementation

Use existing Node path and filesystem APIs. Keep per-attempt ownership so retries remain distinguishable. Use the current report's attachment name and content type as labels, bounded and escaped using the existing report-rendering conventions. Do not add dependencies or a new command.
