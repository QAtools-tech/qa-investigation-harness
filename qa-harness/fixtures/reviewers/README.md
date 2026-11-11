# Focused reviewer examples

Synthetic, prose-only scenarios for checking reviewer behavior. They contain
no Playwright code and are not production decisions.

| Scenario | Expected behavior |
|---|---|
| `risk-candidate/` | Identify T2 as a candidate gap because reload-after-save is unobserved; cite the transition and exploration evidence, propose a testable persisted-state oracle, and name that persistence evidence is missing. Do not create an approved risk or plan. |
| `missing-approval/` | Stop approved-risk conformance: R1 is still `PROPOSED`; name the missing human decision and do not review/export a mapping. |
| `stale-approval/` | Stop R1 conformance because D1 reviewed `flow-model.md@2026-11-10` while the current risk depends on `flow-model.md@2026-11-11`; name the changed dependency and request human re-review. Preserve the existing TC and mapping. |
| `weak-assertion/` | Report TC-01 as weak: the approved oracle requires persisted state, while the supplied source observation at `test-evidence.md` describes only a visible toast. Cite risks, plan, and source locators; do not edit or run anything. |

The fixtures exercise the shared reviewer contracts. A host still needs its
own session to verify that its custom agent/skill is discovered and that the
configured tool restrictions are applied.

## Fresh-chat walkthroughs

Each walkthrough starts with only the named artifact directory on disk; the
new chat must not rely on prior messages.

1. **Candidate gap and handoff:** With `risk-candidate/` available as
   `qa-artifacts/DEMO-403/`, ask `status DEMO-403`, then `resume DEMO-403`.
   The resolver selects Challenge Part A from the existing flow model. The
   reviewer should cite T2 and the two source rows, name persisted-state
   evidence as missing, and stop for human risk review. No plan is written.
2. **Approval and validation stops:** With `missing-approval/` available as
   `qa-artifacts/CASE-403/`, `resume CASE-403` must stop at the PROPOSED risk
   and request a human decision. With `stale-approval/` available as
   `qa-artifacts/CASE-404/` plus its `specs/` plan, it must name D1's older
   dependency revision and stop export/conformance for R1. With
   `weak-assertion/` available as `qa-artifacts/CASE-402/` plus its `specs/`
   plan, `validate CASE-402` should report the toast-only assertion against
   the persisted-state oracle. It must not infer a runtime result or edit the
   source.

The shared resolver and reviewer instructions define these routes; the
contract test checks the route and stop wording. The fixtures are kept here
instead of `qa-artifacts/` so they cannot be mistaken for a real investigation.

For `weak-assertion/`, the evidence file is a prose-only source observation
because the harness must not author Playwright test code. It provides the
mapped test's locator and assertion behavior for a safe reviewer walkthrough.
