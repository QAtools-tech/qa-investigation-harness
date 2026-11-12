import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkMarkdownLinks } from "./markdown-links.mjs";

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-markdown-links-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("resolves local Markdown links from the containing file", async (t) => {
  const root = await workspace(t);
  await mkdir(path.join(root, "docs", "nested"), { recursive: true });
  await mkdir(path.join(root, "guides", "with space"), { recursive: true });
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(path.join(root, "docs", "guide.md"), "# Guide\n");
  await writeFile(path.join(root, "guides", "with space", "readme.md"), "# Readme\n");
  await writeFile(path.join(root, "assets", "mark.svg"), "<svg/>\n");
  await writeFile(
    path.join(root, "docs", "nested", "start.md"),
    "[guide](../guide.md#top)\n[spaced](<../../guides/with%20space/readme.md>)\n![mark](../../assets/mark.svg)\n",
  );

  const result = await checkMarkdownLinks({ root, files: ["docs/nested/start.md"] });

  assert.deepEqual(result.checkedFiles, ["docs/nested/start.md"]);
  assert.deepEqual(result.issues, []);
});

test("reports a missing local Markdown target with its source locator", async (t) => {
  const root = await workspace(t);
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "start.md"), "# Start\n[missing](../missing.md)\n");

  const result = await checkMarkdownLinks({ root, files: ["docs/start.md"] });

  assert.deepEqual(result.issues, [
    { file: "docs/start.md", line: 2, target: "../missing.md", code: "missing-target" },
  ]);
});

test("ignores external URLs, same-file anchors, and links inside code", async (t) => {
  const root = await workspace(t);
  await writeFile(
    path.join(root, "start.md"),
    "[web](https://example.invalid/path) [mail](mailto:qa@example.invalid) [top](#top)\n`[code](missing.md)`\n```md\n[example](also-missing.md)\n```\n",
  );

  const result = await checkMarkdownLinks({ root, files: ["start.md"] });

  assert.deepEqual(result.issues, []);
});

test("does not resolve source files or targets outside the selected root", async (t) => {
  const root = await workspace(t);
  await writeFile(path.join(root, "start.md"), "[outside](../../outside.md)\n");

  const sourceResult = await checkMarkdownLinks({ root, files: ["../outside.md"] });
  const targetResult = await checkMarkdownLinks({ root, files: ["start.md"] });

  assert.equal(sourceResult.issues[0]?.code, "source-outside-root");
  assert.equal(targetResult.issues[0]?.code, "target-outside-root");
});

test("public documentation links resolve", async () => {
  const root = path.resolve(process.cwd());
  const files = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "qa-harness/README.md",
    "qa-harness/examples.md",
    "qa-harness/CONTRACT.md",
    "qa-harness/INTAKE.md",
    "qa-harness/checks/README.md",
    "qa-harness/adapters/README.md",
    "qa-harness/walkthroughs/csv-case-to-approved-handoff.md",
    "qa-harness/walkthroughs/spec-and-failed-run.md",
    "docs/architecture.md",
    "docs/compatibility.md",
    "docs/migration.md",
    "docs/release/phase-7-verification.md",
  ];

  const result = await checkMarkdownLinks({ root, files });

  assert.deepEqual(result.issues, []);
  assert.equal(result.checkedFiles.length, files.length);
});
