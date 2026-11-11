# Stage 5: validate

Read qa-harness/RULES.md first if you have not already this session.

Input: the ticket ID.

Runs AFTER your project's test-generation agent has produced spec files from
specs/<ticket>.plan.md. Do not author new tests.

For direct review of an existing plan, test, or run without a harness
mapping, use the [investigation contract](../CONTRACT.md). Report only what
the supplied evidence supports. The approved-risk audit below requires the
human decisions and mapping.

--- PART A: oracle conformance ---

Read, in order:
1. qa-artifacts/<ticket>/risks.md — specifically its "## Generated mapping"
   section(s) at the bottom, which list Risk ID → TC ID → File. If no mapping
   section exists, stop and say Part B of the challenge stage has not been
   run yet.
2. specs/<ticket>.plan.md — for each TC ID in the mapping, its `Steps:` and
   `expect:` bullets (including any GAP bullets).
3. The generated spec file at the path the mapping names.

For each row in the mapping, find the corresponding test in the spec file and
record:

| Risk ID | TC ID | Test found? | Assertion (quoted) | Implements the approved oracle from risks.md? |

Flag any row where:
- no test exists at the mapped file, or no test in it matches the TC ID/title
- the assertion checks something weaker than the oracle in risks.md's
  Proposed oracle column for that Risk ID
- the assertion's only evidence is rendered text, where the oracle asked for
  more
- the plan had a GAP bullet for this TC but the generated test does not
  acknowledge it in any form (comment or otherwise)

Write findings to qa-artifacts/<ticket>/validation.md. Do not fix anything
and do not edit the specs.

--- PART B: assertion mutation ---

Run only when asked.

Run the specs and report the raw output. No verdict.

Then, for each test that passed:
1. Mutate one expected value in its assertion to something wrong.
2. Re-run that test alone.
3. Restore the original value immediately.

Mutation is a temporary edit for verification. Never leave a mutated value in
place, and never commit one. Restore before moving to the next test.

Append to validation.md, under "ASSERTION TOO WEAK", any test that still
passed after mutation, with the Risk ID/TC ID and the mutation applied.

Rules:
- Do not fix weak assertions. Report them so the human decides whether to
  re-run the generator or accept the gap.
- Do not report the suite as healthy, adequate, or passing.
