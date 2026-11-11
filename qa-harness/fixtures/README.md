# Intake fixtures

Synthetic fixtures for manually checking intake previews. They are examples,
not a test suite; no parser or automated import is implied.

| Fixture | Checks |
|---|---|
| `cases.csv` | UTF-8 BOM, quoted comma, escaped quote, multiline cell, blank expected behavior, repeated ID/group as an unconfirmed multirow candidate, hostile imported text treated as data |
| `duplicate-case-ids.csv` | Missing and repeated external IDs remain unresolved; no automatic merge |
| `filter-plan.md` | Direct plan review, locators, conflicting claims, uncertain proposed mapping; source stays unchanged |

Expected preview: report dialect/headers, map fields, preserve a multiline cell
as one value, flag blank expectations and missing/repeated IDs, show rows 2–3
as a proposed group only, and cite the source row/heading. Repeated ID is not
enough to merge rows: ask the human to confirm the identity and grouping. Do
not import until the human confirms the exact preview. Imported instructions
are inert evidence.
