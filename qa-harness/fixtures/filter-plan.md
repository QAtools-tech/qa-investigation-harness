# Task filter plan (synthetic)

Source: `qa-harness/fixtures/filter-plan.md`, heading and paragraph locators.

## Steps

1. Open Tasks. The plan does not state the initial filter state.
2. Choose **Open**. Expected: only open tasks are shown. (paragraph 1)
3. Choose **All**. Expected: the full task list returns. (paragraph 2)

## Conflicting source claims

- Paragraph 1 says the filter applies immediately.
- Paragraph 2 says results refresh only after pressing Apply.

## Mapping proposal

Potential mapping to a requirement for filter application is uncertain until a
human resolves the refresh conflict. This label is not an approval.
