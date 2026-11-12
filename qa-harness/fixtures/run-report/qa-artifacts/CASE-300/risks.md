# Risks: Synthetic filter flow
Ticket: CASE-300
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ID | Step/State | Risk | Proposed oracle | Observable | Status | Requirement IDs |
|---|---|---|---|---|---|---|
| R1 | Filter | The list may show a stale result | Only matching tasks are returned | yes | APPROVED | C1 |

## Human decision
| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |
|---|---|---|---|---|---|
| D1 | R1 | APPROVED | 2026-11-11 | R1 revision 1; exact oracle in row above | flow-model.md@2026-11-11 |

## Generated mapping (2026-11-11)
| Risk ID | TC ID | File |
|---|---|---|
| R1 | TC-01 | tests/filter.spec.ts |
