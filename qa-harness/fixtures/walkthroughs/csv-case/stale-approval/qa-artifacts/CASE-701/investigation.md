# Investigation: Filter open tasks
Format version: 1
Local ID: CASE-701
Captured: 2026-11-11

## Sources
| ID | Kind | Locator | Captured | Revision or digest | External identity |
|---|---|---|---|---|---|
| S1 | CSV | fixtures/walkthroughs/csv-case/cases.csv row 2 | 2026-11-11 | sha256:fixture-case-701-v1 | none |
| S2 | Markdown | fixtures/walkthroughs/csv-case/recorded-observations.md | 2026-11-11 | fixture-observations-v1 | none |
| S3 | Markdown | fixtures/walkthroughs/csv-case/stale-approval/change-note.md | 2026-11-11 | scope-revision-2 | none |

## Cases and requirements
| ID | Kind | Title or claim | Source ID | Location | Revision |
|---|---|---|---|---|---|
| C1 | case | Filter open tasks | S1 | row 2 | 1 |
| Q1 | requirement | Open and Blocked tasks appear; Closed tasks are hidden | S3 | heading: Updated expected result | 2 |

## Missing inputs
- Live non-production URL and interactive account; synthetic observations are used for this offline walkthrough.

## Run evidence
| ID | Source ID | Test/run reference | Observed result | Environment | Code revision |
|---|---|---|---|---|---|

## Conflicting claims
- none

## Import history
| Source ID | Source revision | Mapping revision | Case IDs | Result |
|---|---|---|---|---|
| S1 | sha256:fixture-case-701-v1 | map-1 | C1 | imported |
| S2 | fixture-observations-v1 | map-1 | Q1 | imported synthetic evidence |
| S3 | scope-revision-2 | map-2 | Q1 | changed requirement; review impact |
