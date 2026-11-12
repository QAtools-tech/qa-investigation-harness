# Risks: Filter open tasks
Format version: 1
Ticket: CASE-701
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ID | Step/State | Risk | Proposed oracle | Observable | Status | Requirement IDs |
|---|---|---|---|---|---|---|
| R1 | T1 / filtered tasks | A Closed task remains visible after selecting Open | Tasks labeled Open or Blocked appear and the known Closed task is absent | yes | APPROVED | Q1 |

## Human decision
| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |
|---|---|---|---|---|---|
| D1 | R1 | APPROVED | 2026-11-11 | R1 revision 1; Oracle: Only Open tasks appear; Closed tasks are hidden | investigation.md@revision-1; flow-model.md@2026-11-11 |

## Change for walkthrough
- The current requirement in `investigation.md` is revision 2 and includes Blocked tasks. D1 reviewed revision 1's narrower oracle. The decision is stale; ask the human to review the changed oracle and preserve D1.
