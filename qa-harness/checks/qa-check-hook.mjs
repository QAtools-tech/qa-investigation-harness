import { checkArtifacts } from "./qa-check.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function hookFailure(message) {
  return {
    exitCode: 0,
    stderr: "",
    stdout: JSON.stringify({ systemMessage: `${message} Run the manual check: node qa-harness/checks/qa-check.mjs --root <repo-root>.` }),
  };
}

/** Adapt a Codex PostToolUse event to the shared, read-only artifact checker. */
export async function handleHookEvent(eventText) {
  let event;
  try {
    event = JSON.parse(eventText);
  } catch {
    return hookFailure("QA check hook received malformed event JSON.");
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return hookFailure("QA check hook expected a JSON event object.");
  }
  if (event.hook_event_name !== "PostToolUse") {
    return hookFailure("QA check hook expected a PostToolUse event.");
  }
  if (typeof event.cwd !== "string" || event.cwd.length === 0) {
    return hookFailure("QA check hook did not receive a working directory.");
  }

  try {
    const { diagnostics } = await checkArtifacts(event.cwd);
    if (diagnostics.length === 0) return { exitCode: 0, stderr: "", stdout: "{}" };
    const limit = 30;
    const lines = diagnostics.slice(0, limit).map((item) =>
      `${item.path}:${item.line} [${item.code}] ${item.message}`,
    );
    if (diagnostics.length > limit) lines.push(`... ${diagnostics.length - limit} more diagnostics; run the manual checker.`);
    return {
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `QA artifact checker found issues:\n${lines.join("\n")}\nRun: node qa-harness/checks/qa-check.mjs --root <repo-root>`,
        },
      }),
    };
  } catch {
    return hookFailure("QA check hook could not inspect the workspace.");
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
if (isMain) {
  const result = await handleHookEvent(await readStdin());
  process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.exitCode;
}
