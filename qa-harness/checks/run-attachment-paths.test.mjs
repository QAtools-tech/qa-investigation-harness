import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveRunAttachmentPaths } from "./run-attachment-paths.mjs";

test("links only canonical in-root regular files and discards unsafe candidate paths", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "qa-run-attachments-"));
  const root = path.join(tempRoot, "project");
  const outside = path.join(tempRoot, "outside");
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await mkdir(path.join(root, "directory"), { recursive: true });
  await mkdir(outside);
  const relativeFile = path.join(root, "test-results", "trace.zip");
  const absoluteFile = path.join(root, "test-results", "absolute.zip");
  const outsideFile = path.join(outside, "private.zip");
  await Promise.all([
    writeFile(relativeFile, "synthetic"),
    writeFile(absoluteFile, "synthetic"),
    writeFile(outsideFile, "synthetic"),
  ]);
  const junction = path.join(root, "linked-outside");
  await symlink(outside, junction, "junction");
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const input = {
    tests: [{ attempts: [{ attachments: [
      { name: "relative", contentType: "application/zip", candidatePath: "test-results/trace.zip" },
      { name: "absolute", contentType: "application/zip", candidatePath: absoluteFile },
      { name: "missing", contentType: "application/zip", candidatePath: "test-results/missing.zip" },
      { name: "directory", contentType: null, candidatePath: "directory" },
      { name: "traversal", contentType: null, candidatePath: "../outside/private.zip" },
      { name: "absolute outside", contentType: null, candidatePath: outsideFile },
      { name: "symlink escape", contentType: null, candidatePath: "linked-outside/private.zip" },
      { name: "invalid", contentType: null, candidatePath: 42 },
    ] }] }],
  };

  const resolved = await resolveRunAttachmentPaths(input, await realpath(root));
  const attachments = resolved.tests[0].attempts[0].attachments;

  assert.deepEqual(attachments.map(({ path: filePath, availability }) => [filePath, availability]), [
    ["test-results/trace.zip", "available"],
    ["test-results/absolute.zip", "available"],
    [null, "unavailable"],
    [null, "unavailable"],
    [null, "unavailable"],
    [null, "unavailable"],
    [null, "unavailable"],
    [null, "unavailable"],
  ]);
  assert.equal(JSON.stringify(resolved).includes(tempRoot), false);
  assert.equal(JSON.stringify(resolved).includes("candidatePath"), false);
});
