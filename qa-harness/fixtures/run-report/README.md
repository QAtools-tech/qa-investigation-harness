# Synthetic Playwright run report fixture

This fixture is synthetic. It contains no customer data or credentials.
It includes no executable Playwright test code. The `tests/filter.spec.ts` file
is an empty placeholder used only to test whether a mapped source locator exists.

`playwright-report.json` covers an expected result, an unexpected failure, a
skipped result, and a flaky result with a retry. Its attachment, stdout, and
error fields contain synthetic markers so the parser tests can confirm they
are not copied into normalized output.

The companion `qa-artifacts/CASE-300/` and `specs/CASE-300.plan.md` files
exercise explicit requirement, decision, plan, mapping, and run links. They are
offline fixtures only; the harness does not execute any file in this directory.
