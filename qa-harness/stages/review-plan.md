# Review an existing plan or spec

Read `RULES.md`, `CONTRACT.md`, and `INTAKE.md` first. Review the supplied
plan directly; do not require Explore, Model, or Challenge when the plan is
the available evidence. This is a read-only conformance and clarity review.

1. Identify the plan path/revision and cite each finding by heading, line, or
   other stable locator. If unavailable, ask for the plan and locator.
2. Summarize its steps, expected outcomes, and observable oracles. Separate
   explicit source claims from interpretation.
3. Report missing/ambiguous preconditions, steps, expected behavior, data,
   state transitions, and oracle coverage. Identify conflicting claims with
   both source locators.
4. Where useful, offer clearly labeled proposed mappings from plan statements
   to cases, requirements, or risks. Include confidence/uncertainty and the
   source locator; never present a proposal as an approved decision.
5. Ask for expected behavior when conformance cannot be judged. Name missing
   evidence by file or claim and stop that judgment.

Report findings in chat. Do not edit or normalize the source plan, create a
generator-facing plan, invent a risk table, approve/reject risks, or author
test code. A source's `approved` label remains a source claim. If the human
asks for export, route through the contract's approved export prerequisites;
missing or stale approval must stop before any plan write.
