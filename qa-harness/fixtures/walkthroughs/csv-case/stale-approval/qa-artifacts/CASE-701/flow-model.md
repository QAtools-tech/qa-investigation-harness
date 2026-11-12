# Flow model: Filter open tasks
Source: fixtures/walkthroughs/csv-case/recorded-observations.md (2026-11-11)
Modeled: 2026-11-11

## States
- S0: All tasks are visible.
- S1: Tasks are filtered to Open.

## Transitions
- T1: Select Open; O1 reports two Open tasks visible and the Closed task hidden.
- T2: Select All; O2 reports all three tasks visible.

## Unknowns
- Reload persistence was not observed.
- The fixture is not a live browser observation; live behavior is unverified.
