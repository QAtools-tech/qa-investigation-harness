# Flow model: Synthetic filter save

Investigation: DEMO-403
Built from: exploration.md (2026-11-11)
Modeled: 2026-11-11

## States

| ID | State | Evidence |
|---|---|---|
| S1 | Filter editor open | `exploration.md#Steps observed`, row 1 |
| S2 | Save confirmation visible | `exploration.md#Steps observed`, row 2 |

## Transitions

| ID | From | Action | To | Evidence |
|---|---|---|---|---|
| T1 | S1 | Select Save | S2 | `exploration.md#Steps observed`, row 2 |
| T2 | S2 | Reload page | Unknown | Not observed |

## Unobserved transitions
- T2: Reload after save; persisted filter state was not observed.
