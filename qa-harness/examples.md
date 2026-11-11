# Public examples

These synthetic walkthroughs demonstrate the [investigation contract](CONTRACT.md).
For reproducible first-run instructions, use [CSV case to an approved handoff](walkthroughs/csv-case-to-approved-handoff.md)
and [existing spec plus failed run](walkthroughs/spec-and-failed-run.md).

## CSV case to approved handoff

Intake starts with `cases.csv`, row 2:

```csv
case_id,title,steps,expected_result
C17,Filter tasks,Select Open in the status filter,
```

Use local investigation `task-filter` and source `S1` pointing to row 2.
Intake reports that the expected result is missing. Ask the case owner what
should happen to closed tasks. The owner supplies “Only open tasks appear,”
recorded as requirement `Q1` with the clarification as its source.

With a confirmed non-production environment and interactive access, Explore
records `O1`: selecting Open left two known open tasks visible and hid a
known closed task. Model records the transition from all tasks to open tasks.
Challenge proposes `R1`: closed tasks could remain visible. The oracle
requires the two known open tasks to appear and the known closed task to
be absent. The human approves the current risk and oracle with references to
`Q1` and `O1`. Given an existing matching seed in the consuming project,
export `specs/task-filter.plan.md` with `TC-01` and record the mapping from
`R1` to `TC-01` and the intended test path. The human hands the plan to the
project generator.

If `Q1` later changes to include blocked tasks, the linked approval becomes
stale. Ask the human to review the affected oracle before exporting a new
entry. Keep the original decision and TC entry.

## Existing spec and failed run

A user supplies `specs/filter.plan.md`, whose expected result says only
open tasks appear, and run `RUN-12`, whose failure says the closed row was
still visible. There is no ticket, risk table, or generated mapping.

Start in triage because the supplied run contains failure evidence. Record
both sources and report that the runner observed the closed row at assertion
time. The test source and fixture setup are missing. Ask for the corresponding
assertion and fixture to assess whether the failure reflects filtering, setup,
or timing. If the user instead requests an approved-risk audit, stop because
the human decisions and generated mapping are also missing.
