# Flow: Synthetic filter save
Ticket: DEMO-403
Test case: Save a filter and confirm it is retained after reload.
Explored: 2026-11-11
URL: https://example.invalid/tasks

## Steps observed
| # | Action | Element (role/name) | Observed change | In test case? |
|---|---|---|---|---|
| 1 | Open filter editor | button / Filters | Filter editor opens | yes |
| 2 | Select Save | button / Save | “Saved” toast appears | yes |

## Not observable from the browser
- Whether the filter was persisted for the next page load.
