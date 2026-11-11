# Risks: Synthetic filter flow
Ticket: CASE-402
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ID | Step/State | Risk | Proposed oracle | Observable | Status |
|---|---|---|---|---|---|
| R1 | Save filter | Save confirmation may not persist | Filter remains stored after reload, verified from persisted application state | partial | APPROVED |

## Human decision
| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |
|---|---|---|---|---|---|
| D1 | R1 | APPROVED | 2026-11-11 | R1 revision 1; exact oracle in row above | flow-model.md@2026-11-11 |

## Generated mapping (2026-11-11)
| Risk ID | TC ID | File |
|---|---|---|
| R1 | TC-01 | test-evidence.md |
