# Phase 7 verification report

Date: 2026-11-11
Branch: `codex/qa-harness-phase-7`
Base: pushed Phase 6 commit `31df76d`

## Result

The review-boundary portions of both public walkthroughs completed in a clean
Phase 6 checkout with only Phase 7 public materials overlaid. The CSV example
did not exercise a human-approved handoff or Stage 3B. A fresh agent that had
not seen the implementation plan followed the corrected examples. It selected
the right entry points, named missing evidence, and stopped before plan/export
when human approval was absent or stale. This is synthetic agent rehearsal
only; real-human adoption remains unverified.

## First attempt and corrections

The first fresh attempt selected Intake for the CSV case, correctly identified
the blank `expected_result`, and requested the expected behavior. It stopped
before writing because the walkthrough did not include the intake confirmation
required by `stages/intake.md`, while its next section assumed intake had
completed. The walkthrough now includes an explicit synthetic confirmation
that permits only writing the intake record; it says a real chat must wait for
the actual user's confirmation.

The second attempt completed that intake but selected the normal Explore
prerequisite next, because no non-production URL or account was supplied. It
could not reach the promised proposed-risk status blocker. Review found a
contract/stage mismatch: the contract permits direct Model from imported
observations, while `stages/02-model.md` described only `exploration.md` and
browser-derived uncertainty. The Model instructions now accept imported
observation sources and preserve their locators and uncertainty. The walkthrough
now explicitly uses that offline direct entry and disclaims browser activity.

## Corrected independent rehearsal

- **CSV case:** selected Intake. It named row 2, the blank expected result,
  source mapping, and the need for the case-owner clarification. After the
  scripted synthetic confirmation, the temporary snapshot received only
  `investigation.md`, `flow-model.md`, and a PROPOSED-only `risks.md`.
- **Missing approval:** `status CASE-701` and `resume CASE-701` stopped for
  human risk review. No decision, generated mapping, or plan was created; no
  export occurred.
- **Stale approval:** the fixture's D1 reviewed the Open-only oracle, while
  current Q1 includes Open and Blocked. The reviewer named R1 as stale, kept D1
  intact, requested fresh human review, and stopped before export.
- **Spec and failed run:** selected Triage. It kept the observed Closed row
  after selecting Open separate from any cause. It named the missing assertion
  source, fixture/setup state, retry history, application revision, and
  environment. It also surfaced the plan's conflicting filter/apply timing.
  Approved-risk audit stopped because human decision, generated mapping, and
  test source were absent. No artifacts or test code were created.

The rehearsal followed both walkthroughs from a clean checkout and did not
inspect the design or implementation plan. The optional report CLI was not
run because it writes report artifacts. The stale fixture was inspected
read-only. The disposable snapshots are outside this repository.

## Local verification

- Full built-in Node suite:
  `node --test qa-harness/checks/*.test.mjs qa-harness/adapters/*.test.mjs qa-harness/adapters/jira/*.test.mjs`
  — **81 passed, 0 failed**.
- Legacy fixture check:
  `node qa-harness/checks/qa-check.mjs --root qa-harness/fixtures/checks`
  — **2 files checked, 0 diagnostics**.
- Public Markdown link integration test passed as part of the full suite.
- `git diff --check` passed. Git reported only existing LF-to-CRLF notices for
  edited Markdown files.
- The repository credential-pattern scan produced broad keyword matches; the
  previously reviewed Jira cursor examples are synthetic pagination values,
  not credentials. No credential-shaped values were found. The new Phase 7
  walkthroughs and synthetic fixtures contain no credential values.

## Limits and remaining checks

- Real-human adoption has not been observed.
- No browser session or non-production application was available; browser
  behavior remains unverified.
- No consuming-project test generator was invoked; generated tests remain
  unverified and are outside this harness.
- No live Jira or other provider connection was used. Jira live host binding
  and credentials remain unverified.
- No release or publication was performed.
