# Stage 1: explore

Read qa-harness/RULES.md first if you have not already this session.

Explore the flow described by a test case, using Playwright MCP.
Write no test code and no analysis.

You need two inputs from the human before starting, if not already given:
- Investigation ID under the [investigation contract](../CONTRACT.md).
  Use the existing ticket ID for legacy investigations. For new
  investigations, use the local ID wherever this stage says `<ticket>`.
- Test case — title + rough steps, however informal

1. BASE_URL and TEST_ACCOUNT are not configured. Ask the human for both before
   navigating. Confirm the URL is not production. Never write the credentials
   into any file — the confirmed non-production URL itself may be recorded,
   since the generated plan will need it.
2. Create qa-artifacts/<ticket>/ if needed. The ticket ID is the identifier
   for this flow throughout the harness — there is no separate invented slug.
3. Walk the path the test case describes, once.
4. At each step record: the action, the accessibility-tree element used
   (role + name), the URL if it changed, and what visibly changed afterward.
5. Record anything you observed that the test case does NOT mention. This is
   a separate section and it matters — the test case is a claim about the
   flow, not a description of it.
6. Record everything you could NOT observe from the browser (persisted state,
   audit logs, emails, background jobs).
7. Search your project's spec/test directory for existing files whose name
   suggests they are a seed (contains "seed"). For each one found, note what
   starting state it appears to establish (read enough of it to tell — e.g.
   does it log in, does it create fresh data, does it just navigate) and
   whether that matches the state the app was in when you began this
   exploration.

Write to qa-artifacts/<ticket>/exploration.md:

```markdown
# Flow: <test case title>
Ticket: <ticket ID>
Test case: <the original text, verbatim>
Explored: <ISO date>
URL: <confirmed non-production base URL>

## Steps observed
| # | Action | Element (role/name) | Observed change | In test case? |

## Observed but not in the test case
- <list>

## Described in the test case but not observed
- <list>

## Not observable from the browser
- <list>

## Candidate seed files
| File | Apparent starting state | Matches this flow's starting state? |

## Open questions
- <anything you were unsure about>
```

Rules:
- Record only what you actually observed. Anything inferred goes under Open
  questions, never under Steps.
- Never write credentials into the file, under any heading.
- Do not propose tests, risks, or fixes. Do not rank anything.
- If qa-artifacts/<ticket>/risks.md already exists with APPROVED rows, say so
  before writing, because re-exploring invalidates those approvals.
- Candidate seed files are read-only discovery. If no existing file matches,
  write "none found" — never propose creating one. A seed file is Playwright
  test code and this harness does not author test code, seed or otherwise.
