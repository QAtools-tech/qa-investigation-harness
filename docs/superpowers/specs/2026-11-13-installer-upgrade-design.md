# Installer Upgrade Design

## Goal

Let a project move to a newer published harness version while preserving its
investigation records and any locally edited harness files. Every file the
installer changes must be identifiable as harness-owned and unchanged since
the prior version.

## Current behavior

`qa-investigation-harness install --client <client>` adds `qa-harness/` and the
selected client's skill files. It reuses identical files and stops before
writing if an existing path differs. It records no installed version or file
baseline, so it cannot yet distinguish an older upstream file from a local edit.

## Approaches considered

1. **Per-file safe upgrade (selected).** Track the last upstream hash for each
   managed file. Update files that still match it; keep changed files and save
   the incoming upstream copy separately. This updates clean files while
   retaining edits for review.
2. **All-or-nothing stop.** Refuse the entire upgrade if any file differs.
   This is easy to reason about, but one edited file blocks every unrelated
   upstream fix.
3. **Interactive overwrite prompts.** Ask before replacing each changed file.
   This can be safe in a terminal, but is unreliable in `npx`, IDE, and
   automation contexts and makes repeat runs harder to audit.

## Proposed behavior

- Keep `install` additive and non-destructive. Add a separate explicit
  `upgrade --client <claude|codex|copilot>` command.
- Store metadata under `.qa-investigation-harness/installer-state.json` in the
  consuming project. Record schema version, installed package version, and a
  SHA-256 baseline for each managed project-relative path. Do not store file
  contents in the state file.
- The managed set is only the shared `qa-harness/` bundle and the selected
  client's installed skills. Investigation data such as `qa-artifacts/` is
  outside that set and is never read, copied, renamed, or deleted by upgrade.
- For a managed path whose current hash matches its recorded baseline, replace
  it with the new package version and advance the baseline.
- For a changed managed path, leave it untouched and copy the new upstream
  version to `.qa-investigation-harness/conflicts/<version>/<path>`. Report the
  conflict and the saved copy's path. Repeated runs reuse an identical saved
  copy; they do not overwrite a user-edited conflict copy.
- Install new upstream files only when their destination is absent. If an
  untracked path already exists, preserve it and save the incoming file as a
  conflict copy.
- Never delete a destination when an upstream file disappears. Report it as
  obsolete for manual review.
- Preflight every destination for unsupported path types and symlinks before
  writing. Keep the current installer's fail-closed path safety.
- Report updated, added, unchanged, preserved, conflicted, and obsolete paths.
  A conflict leaves the local file in place and makes the command exit
  non-zero so scripts cannot mistake a partial upgrade for a clean one.
- After a user reviews and merges a conflict, provide an explicit
  `--accept-local <path>` operation that records the resolved current file as
  the new baseline. This is a deliberate acknowledgment; it never changes the
  file itself.

## Existing installations

The published `0.1.0` installer did not write state metadata. Ship a generated
`0.1.0` baseline manifest with the upgrade-capable package. Generate it from
the published `qa-investigation-harness@0.1.0` tarball and verify that the
paths match the installer's destination mapping. Compare existing files to
that baseline so untouched files can upgrade and edited files are preserved.

If an installation's version or baseline cannot be identified, treat every
existing destination as locally owned: preserve it and save the incoming
upstream copy for manual review. Missing destinations can still be added.

## Failure and recovery

Preflight before mutation. Apply updates per file, and persist each baseline
only after its file operation succeeds. If a later write fails, report the
completed paths and the remaining paths; rerunning is safe because completed
files match the recorded baseline and identical conflict copies are reused.
Never roll back, rewrite, or infer state for investigation artifacts.

## Acceptance criteria

- A fresh install records a baseline and behaves as it does today for occupied
  differing paths.
- An existing 0.1.0 installation can upgrade clean files using the shipped
  0.1.0 baseline.
- Local edits remain byte-for-byte unchanged; the new upstream copy is
  available at a reported path.
- A second upgrade is idempotent and does not overwrite edits or conflict
  copies.
- Investigation artifacts remain unchanged across install, upgrade, conflict
  handling, and recovery.
- New files, missing files, upstream removals, multiple clients, and symlink or
  conflicting-path cases have explicit tests.
