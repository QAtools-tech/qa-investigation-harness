# Installer Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe upgrade command that advances unchanged harness files and preserves local edits and investigation history.

**Architecture:** Keep the existing CLI entry point and extend it with an explicit `upgrade` command. Record per-file SHA-256 baselines in project metadata; seed old 0.1.0 installs from a packaged manifest generated from the published tarball. Preserve changed files and save upstream copies under the metadata directory.

**Tech Stack:** Node.js 20+ built-in filesystem, crypto, child process, and test modules; no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-11-13-installer-upgrade-design.md`](../specs/2026-11-13-installer-upgrade-design.md)

## Global Constraints

- `install` remains additive and refuses differing occupied paths.
- `upgrade` only manages `qa-harness/` and selected-client skill files; never touch `qa-artifacts/`.
- Never replace locally changed files or existing non-identical conflict copies.
- Never delete files removed from upstream.
- Preflight paths and symlinks before writes; persist a baseline only after the corresponding file operation succeeds.
- Existing 0.1.0 installs use a baseline verified against the published tarball.

## Review Focus

- Manifest missing, malformed, stale, or manually edited: refuse unsafe replacement and report the affected path.
- Existing 0.1.0 files locally edited: preserve bytes and provide the exact upstream copy path.
- Conflict copy already edited: preserve both local versions and report copy-path collision.
- Interrupted update: completed files remain recorded; rerun safely completes remaining work.
- Multiple clients and symlink destinations: update shared files once and never traverse a link.

---

### Task 1: Track files installed by the current package

**Files:**
- Modify: `bin/qa-investigation-harness.mjs`
- Create: `scripts/installer.test.mjs`

**Interfaces:** The state file is `.qa-investigation-harness/installer-state.json`, with schema version `1`, package version, and a map of managed project-relative paths to `{ version, sha256 }`.

- [x] Build a temporary fake package root in the test helper, run the real CLI in a disposable project, and write the failing test `records managed file hashes on first install`; assert the state tracks shared files and the selected client's skill files.
- [x] Run `node --test scripts/installer.test.mjs`; confirm the new assertion fails because the installer currently writes no state.
- [x] Update `install` to preflight existing targets, preserve current add/identical behavior, and atomically persist hashes for successful managed files. Do not modify the state file when any existing differing target rejects installation.
- [x] Add and run `install refuses invalid state metadata without changing targets`; assert malformed metadata is preserved and install exits non-zero before writes.

### Task 2: Upgrade clean files and isolate conflicts

**Files:**
- Modify: `bin/qa-investigation-harness.mjs`
- Create: `bin/upgrade-baselines/0.1.0.json`
- Modify: `scripts/installer.test.mjs`

**Interfaces:** `upgrade --client <client>` updates shared files and the selected client's skills. `upgrade --client <client> --accept-local <project-relative-path>` explicitly adopts a resolved local file as its new baseline.

- [x] Download and unpack `qa-investigation-harness@0.1.0` into a temporary directory; generate `bin/upgrade-baselines/0.1.0.json` from its actual managed files and verify source-to-destination mappings for Claude, Codex, and Copilot.
- [x] Add tests for clean legacy 0.1.0 replacement, preservation plus upstream conflict copy for a locally edited file, idempotent rerun, new file collision, obsolete upstream file preservation, explicit local acceptance, and protected `qa-artifacts/` bytes; verify these fail before implementation.
- [x] Add `upgrade` parsing and per-file decisions. Use the stored manifest when present and the packaged 0.1.0 baseline when migrating legacy installs. For unknown baselines, preserve occupied targets and only add absent files.
- [x] Preflight all target and conflict-copy paths. Update clean files atomically, update state only after successful writes, and report updated/added/unchanged/preserved/conflicted/obsolete paths with non-zero status for unresolved conflicts.
- [x] Run `node --test scripts/installer.test.mjs`; confirm the migration, conflict, rerun, acceptance, and artifact-preservation cases pass.

### Task 3: Verify package delivery and document the command

**Files:**
- Modify: `scripts/check-packed-installer.mjs`
- Modify: `.github/workflows/qa-harness-check.yml`
- Modify: `README.md`
- Modify: `docs/compatibility.md`

- [x] Extend the packed smoke check to confirm the package includes the baseline manifest and the installed state records the published package version for all three clients.
- [x] Add `node --test scripts/installer.test.mjs` to CI and run the full repository suite plus `node scripts/check-packed-installer.mjs`.
- [x] Document fresh install, safe upgrade, conflict-copy review, `--accept-local`, and legacy 0.1.0 migration. Keep the statement that investigation artifacts are outside installer scope.
- [x] Run `git diff --check`, inspect package contents with `npm pack --dry-run`, and review the final diff against the design acceptance criteria.
