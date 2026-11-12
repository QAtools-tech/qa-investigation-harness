# Migration guide

Use this guide when adopting the current investigation contract or changing
client integrations. Migration is a human-reviewed copy/update process; the
repository does not provide an automatic artifact converter.

## Preserve legacy investigations

Existing ticket-key paths remain valid. Keep the complete
`qa-artifacts/<ticket>/` directory and `specs/<ticket>.plan.md` at their
current paths. Do not rename an active legacy investigation to a local ID just
to adopt the v1 contract.

Before any manual copy or project move:

1. Make a verified backup of the full artifact directory and plan. Include
   referenced mapping/test files when they are in the same project. Keep the
   original copy unchanged until the new location has been reviewed.
2. Record the original ticket key, file paths, source locators, TC IDs, risk
   decisions, mappings, and the consumer project root. Preserve the source's
   provider, instance/project scope, object kind, and external ID when known.
3. Copy the files without rewriting IDs or dates. Run the artifact checker on
   the copy, then ask `status <ticket>` to inspect its dependencies. The
   structural checker does not establish approval freshness.
4. If a source, requirement, risk, oracle, or dependency changed, preserve the
   previous records and request a human review of the affected decision. Do
   not convert a legacy date chain or imported `APPROVED` label into a v1 human
   approval. Dates order evidence; they do not prove approval.
5. Compare the copied plan against every mapping before resuming. Do not
   renumber or duplicate TC entries. Reconcile missing or conflicting
   mappings with the human before export or validation.
6. Keep the original backup until the copied investigation has been verified.
   If identity or provenance is uncertain, stop and continue from the
   unchanged original rather than merging artifacts.

For new local investigations, use a confirmed local ID while preserving any
ticket identity as a scoped source reference. Follow the identity and approval
rules in the [investigation contract](../qa-harness/CONTRACT.md) and
[intake guide](../qa-harness/INTAKE.md). A local ID is not a replacement for
the external source locator.

## Move VS Code prompts to the Copilot harness

The repository's `.github/prompts/qa-*.prompt.md` files are for VS Code's
Local harness. Microsoft's current documentation says prompt files are not
loaded by Copilot harness sessions; reusable Copilot workflows use skills.
The Local harness is scheduled for removal in February 2027.

For plain-language use, open Copilot Chat with the repository root and follow
[the guided chat walkthrough](../qa-harness/walkthroughs/guided-chat.md). The
repository's Copilot instructions already point to the shared guide.

To replace the Local prompt shortcuts with Copilot skills:

1. Follow Microsoft's [prompt-file migration guide](https://code.visualstudio.com/docs/agent-customization/migrate-customizations)
   and convert each prompt into a workspace skill in `.github/skills/` (or
   `.agents/skills/` if that is the chosen shared location).
2. Preserve the thin-wrapper rule: each skill points to the canonical
   `qa-harness/` contract and stage file rather than copying its methodology.
3. Review how prompt-specific agent, model, and tool settings map to the new
   skill. Do not assume conversion preserves them.
4. Verify discovery and behavior in a new Copilot harness chat for each
   workflow. Test the correct entry point, missing-evidence response, and
   human approval stop before sharing the converted skills.
5. Leave the Local prompt files in place until the Copilot skills pass those
   checks. This repository has not completed or live-verified that migration.

Use [compatibility status](compatibility.md) to distinguish this migration
guidance from an already-supported adapter. Keep credentials out of skill
files, prompts, artifacts, and source control.
