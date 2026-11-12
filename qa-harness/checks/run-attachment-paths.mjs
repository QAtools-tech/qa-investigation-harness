import { realpath, stat } from "node:fs/promises";
import path from "node:path";

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolveAttachment(attachment, projectRootReal) {
  const name = typeof attachment?.name === "string" ? attachment.name.slice(0, 500) : null;
  const contentType = typeof attachment?.contentType === "string" ? attachment.contentType.slice(0, 200) : null;
  let filePath = null;
  if (typeof attachment?.candidatePath === "string" && attachment.candidatePath !== "") {
    try {
      const candidate = path.isAbsolute(attachment.candidatePath)
        ? path.resolve(attachment.candidatePath)
        : path.resolve(projectRootReal, attachment.candidatePath);
      const canonical = await realpath(candidate);
      if (isInside(projectRootReal, canonical) && (await stat(canonical)).isFile()) {
        filePath = path.relative(projectRootReal, canonical).split(path.sep).join("/");
      }
    } catch {
      // Missing, unreadable, or invalid attachment paths are omitted from reports.
    }
  }
  return { name, contentType, path: filePath, availability: filePath ? "available" : "unavailable" };
}

/** Resolve report attachment paths without exposing unsafe input paths. */
export async function resolveRunAttachmentPaths(run, projectRootReal) {
  const tests = await Promise.all((run.tests ?? []).map(async (test) => ({
    ...test,
    attempts: await Promise.all((test.attempts ?? []).map(async (attempt) => ({
      ...attempt,
      attachments: await Promise.all((attempt.attachments ?? []).map((attachment) => resolveAttachment(attachment, projectRootReal))),
    }))),
  })));
  return { ...run, tests };
}
