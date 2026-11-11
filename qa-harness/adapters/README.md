# Optional source adapters

Start with [`CONTRACT.md`](CONTRACT.md) and its normalized-record schema.
Adapters only retrieve evidence; the existing intake flow still previews the
source mapping and asks for confirmation before writing `investigation.md`.
Manual pasted, Markdown, and CSV intake remains available without any
provider connection.

## Pilot compatibility

| Provider/capability | Fixture tests | Live verification | Boundary |
|---|---|---|---|
| Jira issue lookup | Yes | Not yet | Requires a host-provided read-only Jira client and explicit project/issue-type mapping |
| Jira case/requirement search | Yes | Not yet | Requires a host-provided search client; uses typed filters, a project-scoped query, one bounded page, and an explicit cursor for each next page |
| Confluence excerpts | Not implemented | Not verified | Future adapter; Jira issue descriptions are not treated as Confluence documents |
| Xray cases/executions | Not implemented | Not verified | Separate test-manager capability and permission; Jira issue access does not establish Xray access |
| Azure Boards/Test Plans/Pipelines | Not implemented | Not verified | Separate provider adapter and permission scope |

The reusable contract and Jira normalizer are fixture-tested. A live Jira pilot
still requires a connected Atlassian client and a user-selected issue in a
scoped project. No provider content is copied into the repository fixtures.

## Host binding status

The normalized adapter accepts an injected client; this repository does not
ship a client-specific Atlassian binding. The host must implement the two
read-only client methods in [`jira/README.md`](jira/README.md), keep its
credentials and cloud ID outside investigation artifacts, and verify that its
response shape maps without guessing.

| Host | Jira transport status |
|---|---|
| Codex | Atlassian app is available but not installed in the current session; the read endpoint returned `Unknown tool`. No live binding verified. |
| Claude Code | No Jira host binding implemented or verified here. |
| GitHub Copilot | No Jira host binding implemented or verified here. |

These statuses describe the integration tested by this repository. A host may
provide its own injected client, but that does not make the binding verified.
The manual pasted/Markdown/CSV intake remains available without a connector.

## Jira pilot

See [`jira/README.md`](jira/README.md) for the supported mapping and client
boundary. The adapter deliberately supports only configured Jira issue types.
It does not infer that every Story is a requirement or every issue is a test
case. Unmapped types return `UNSUPPORTED`.

## Test the adapter contract

```sh
node --test qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs
```

The fixtures are synthetic. They contain no real project keys, credentials,
customer records, or provider-owned writes.
