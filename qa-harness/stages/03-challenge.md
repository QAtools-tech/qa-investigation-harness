# Stage 3: challenge

Read qa-harness/RULES.md first if you have not already this session.

Input: the ticket ID.

This stage has two parts. After Part A, stop for human review. Part B
requires human approval of the current risk and oracle. A request to
continue does not supply approval.

Read qa-artifacts/<ticket>/flow-model.md and its source observations, whether
in exploration.md or in imported evidence cited by the model. Use the
investigation ID in place of `<ticket>` for a new investigation.
Write no test code.

--- PART A: risk table ---

For each state, each transition (especially unobserved ones), each item under
"Observed but not in the test case", and the flow as a whole, ask:
- What could fail here?
- What does the test case assume without verifying?
- What evidence would actually prove success?
- Is that evidence observable from the browser?

Write to qa-artifacts/<ticket>/risks.md:

```markdown
# Risks: <flow name>
Ticket: <ticket ID>
Source: flow-model.md (<date from that file>)
Challenged: <ISO date>

| ID | Step/State | Risk | Proposed oracle | Observable | Status |
|----|------------|------|-----------------|------------|--------|
| R1 | ...        | ...  | ...             | yes/no/partial | PROPOSED |
```

Rules:
- Every row starts PROPOSED. Never write APPROVED or REJECTED.
- APPROVED will mean "this risk is real and should be covered." Write each
  row so that decision is answerable in one read.
- Describe oracles in prose. Never write them as code.
- Name the oracle that would ACTUALLY prove success, even when it requires an
  API or database check this project cannot yet perform. Mark those "no" or
  "partial". Never substitute a weaker browser-only check because it is
  reachable today.
- A rendered confirmation message is not evidence of a completed action. Flag
  any row whose only oracle is rendered text as an evidence gap in the Risk
  column.
- Cover every unobserved transition from flow-model.md with at least one row.
- Over-generate. The human's job is rejection, so give candidates to reject
  rather than a pre-filtered list.
- Include at least two rows the browser cannot fully verify.

Then stop and tell the human to review risks.md before running Part B.

--- PART B: test plan for your project's test-generation agent ---

Run only when asked, and only after checking:
1. risks.md contains rows with status APPROVED. If zero, stop and say the
   review is still pending.
2. Check approval freshness and evidence dependencies using the
   [investigation contract](../CONTRACT.md). For legacy investigations,
   check the Source date chain: risks.md → flow-model.md → exploration.md.
   If any required link is stale, report the affected risk and next action.

This writes specs/<ticket>.plan.md — the SAME kind of artifact a planner
agent would normally produce, in a plain documentation structure any
generator agent can read, so the human can hand it off directly.
See qa-harness/RULES.md for why a planner agent is not invoked here instead.

If specs/<ticket>.plan.md already exists:
- Read it first. Never renumber or rewrite existing TC-<NN> entries.
- Append new TC-<NN> entries for newly-approved risks, continuing the
  numbering from the highest existing TC number in the file.
- Check existing mappings before appending. Follow the contract for a
  reviewed revision that supersedes an existing entry.
- If a plan entry appears to have been written before an interrupted mapping
  write, do not duplicate it. Ask the human to identify and confirm the
  matching TC entry; when confirmed and its content matches the approved risk
  and oracle, append only the missing mapping. If a mapping points to a
  missing TC entry or attribution is unclear, stop for human reconciliation.
- If the file has no existing entries for this exact flow, start at TC-01.

If your project already has an established plan-file format (check for
existing files under specs/ before writing), match that format exactly
instead of the template below — the goal is a file indistinguishable from
one written by hand. Otherwise use this structure:

```markdown
# <ticket ID> - <flow title>

## Application Overview

<one paragraph, written from exploration.md: what application/flow this
covers, its URL, and the screens or steps involved. Prose, third person, same
style as a human-written plan — do not mention risks, oracles, or this
harness.>

## Test Scenarios

### 1. <ticket ID> - <flow title>

**Seed:** `<seed file path from exploration.md's Candidate seed files, or, if
none was found, the literal text "NONE FOUND — a seed file must exist before
this can be generated">`

#### 1.<n>. TC-<NN>: <short title derived from the risk>

**File:** `<test file path following your project's existing naming
convention — check tests/ for the pattern before inventing one>`

**Steps:**
  1. <verified step from exploration.md, in the plan's plain action style>
    - expect: <the approved oracle, in prose, as a real behavioral assertion
      — this is what the generator turns into code>
  2. <next step>
    - expect: <...>
```

For each current approved risk revision without a mapping, add one new
`TC-<NN>` block unless the human has confirmed that an existing unmapped plan
entry is the interrupted export for that risk. In that recovery case, verify
the entry's content against the approved risk and oracle, then add only the
missing mapping. Never duplicate or renumber an existing entry. Ground new
steps in the verified path from the source observations.

When a risk's Observable is "no" or "partial", still write a real `expect:`
bullet stating the approved oracle as-is (do not weaken it), then add one
more bullet immediately after it:
    - expect: GAP — browser cannot verify this. Correct oracle requires
      <what the approved oracle actually needs, e.g. an API/DB check>. Not
      wired into this project yet.
This keeps the gap visible to whoever reads the plan or the generated test,
without pretending the browser-level check is sufficient.

Then, in the SAME response, append a new section to the BOTTOM of
qa-artifacts/<ticket>/risks.md — after the existing risk table, which must
not otherwise be touched — recording mappings for new plan entries or
human-confirmed recovery entries:

```markdown

## Generated mapping (<ISO date>)
| Risk ID | TC ID | File |
|---------|-------|------|
| R1      | TC-04 | <file path> |
```

This mapping is what the validate stage uses later to connect an approved
risk to the test that's supposed to cover it. If Part B is run more than
once for this ticket, append a new dated "## Generated mapping" section each
time rather than overwriting the previous one.

Rules:
- Include APPROVED rows only. Ignore PROPOSED and REJECTED entirely, however
  important they appear.
- Write no code — steps and expectations are prose, in the plan's own
  documentation style, not assertions in TypeScript or any other language.
- specs/<ticket>.plan.md must read as a normal test plan. Do not mention
  risks.md, APPROVED status, or this harness inside it — that context lives
  in qa-artifacts/<ticket>/, referenced only from the mapping section in
  risks.md.
- If the seed file is "NONE FOUND", still write the plan, but say plainly to
  the human that generation cannot proceed until a seed file exists, and that
  creating one is outside this harness's authority.
- Do not claim the flow is adequately covered.
