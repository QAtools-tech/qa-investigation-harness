# Adapter author guide

Implement a provider by declaring its supported capabilities, project/scope,
limits, and only the methods it can actually perform. Use the common record
and error shapes from [`CONTRACT.md`](CONTRACT.md). Keep client credentials
inside the provider client, never in adapter descriptors or records.

## Required behavior

1. Require an explicit source reference or bounded filter list. Reject an
   absent or out-of-scope reference before making a provider call.
2. Make read-only calls. Do not add write, transition, comment, delete, or
   approval methods to a QA source adapter.
3. Normalize one page per call. Keep the requested limit, return the opaque
   cursor and `isLast`, and never auto-fetch another page.
4. Preserve provider, instance, project, object kind, external ID, locator,
   source revision, and retrieval time.
5. Bound excerpts at 2,000 characters and report truncation. Preserve unknown
   fields as missing; do not invent steps, expected results, or decisions.
6. Convert provider failures to the contract's fixed error codes. Never return
   raw response bodies, headers, credential text, or arbitrary exception
   messages.
7. Add synthetic fixtures and tests for unsupported capabilities, missing and
   denied records, malformed responses, pagination, revision refresh, and
   provider text with instruction-like content.

## Client boundary

The core normalizer accepts an injected client. A host binding may call its own
MCP or SDK operation and must return the provider object or a typed failure to
the adapter. Each binding is a separate integration that needs its own
capability and live-connection verification. Do not claim support just
because a provider MCP server exists in one client.

For the Jira binding, see [`jira/README.md`](jira/README.md). Keep Atlassian
site lookup and cloud ID state in the host session; do not serialize it into
an investigation artifact.
