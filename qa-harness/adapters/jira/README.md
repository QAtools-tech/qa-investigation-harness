# Jira issue adapter

This pilot turns selected Jira issues into normalized `case` or `requirement`
evidence. It reads no comments, changelogs, attachments, or project-wide data
by default. Xray execution data and Confluence pages require separate
capabilities.

## Configure the adapter

```js
const adapter = createJiraAdapter({
  client, // host wrapper with getIssue and, optionally, searchIssues
  cloudId, // obtained by the host for the active session
  instanceUrl: "https://example.atlassian.net",
  projectKey: "QA",
  issueTypeMap: {
    "Test Case": "case",
    Story: "requirement"
  }
});
```

The mapping is explicit and local to the project. Capabilities are enabled
only for configured record kinds. `documentExcerpt` and `runEvidence` remain
false. If the host does not provide `searchIssues`, the adapter exposes only
direct lookup.

## Read operations

The host wrapper supplies these interfaces:

```js
client.getIssue({ cloudId, issueIdOrKey, view: "evidence" })
client.searchIssues({ cloudId, jql, maxResults, nextPageToken, view: "evidence" })
```

For a future Atlassian MCP binding, the intended read operations are
`getJiraIssue` and `searchJiraIssuesUsingJql`. This mapping has not been
verified against a live connection. Resolve `cloudId` once per host session;
the host binding must unwrap the returned issue fields and map tool errors to
a safe status/code. The normalizer never includes raw error messages.

Direct lookup accepts a Jira issue key or `/browse/<KEY>` URL from the
configured site and project. Search accepts 1–5 typed filters only:

| Field | Operator | Example |
|---|---|---|
| `summary` | `contains` or `eq` | `{ field: "summary", operator: "contains", value: "Saved filter" }` |
| `status` | `eq` | `{ field: "status", operator: "eq", value: "Open" }` |
| `label` | `eq` | `{ field: "label", operator: "eq", value: "qa-case" }` |

The adapter escapes filter values and adds the configured project and mapped
issue types to JQL. It accepts one page of at most 50 records. The caller must
explicitly pass the returned cursor for each subsequent page. The adapter
never broadens the search or follows pages automatically.

## Normalization limits

- `summary` becomes the normalized title. Jira `description` text becomes a
  bounded excerpt; ADF text nodes are extracted without serializing object
  syntax. If the description is blank, the excerpt is absent.
- The adapter does not parse free-form prose into steps or expected results.
  Intake preview identifies those fields as missing when they are not
  explicit.
- The Jira `updated` timestamp is recorded as source revision. Re-reading an
  issue reports its current revision; it does not alter earlier artifacts or
  human decisions.
- Unknown issue types, a response outside the configured project, malformed
  rich text, and invalid references are not silently skipped.

## Verification state

The normalizer and client boundary have synthetic fixture coverage. A live
Atlassian Jira call has not been verified in this environment, so the pilot
must remain labeled fixture-tested until a connected host returns a safe,
user-selected sample successfully.
