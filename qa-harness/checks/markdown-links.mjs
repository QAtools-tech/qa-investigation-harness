import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function posixPath(value) {
  return value.split(path.sep).join("/");
}

function addIssue(issues, file, line, target, code) {
  issues.push({ file, line, target, code });
}

function destinationsIn(markdown) {
  const destinations = [];
  let fence = null;

  for (const [index, originalLine] of markdown.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = originalLine;
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.character && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }

    const withoutInlineCode = line.replace(/(`+).*?\1/g, "");
    const links = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+[^)]*)?\s*\)/g;
    for (const match of withoutInlineCode.matchAll(links)) {
      let target = match[1];
      if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
      if (target) destinations.push({ target, line: lineNumber });
    }
  }

  return destinations;
}

function localPathFrom(target) {
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) return null;
  const delimiter = target.search(/[?#]/);
  const pathname = delimiter < 0 ? target : target.slice(0, delimiter);
  if (!pathname) return null;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return false;
  }
}

/**
 * Check relative inline Markdown links and images inside one selected root.
 * Same-file fragments and external URLs are ignored; fragments do not affect
 * target-file existence checks. The function never writes or fetches URLs.
 */
export async function checkMarkdownLinks({ root, files }) {
  if (!Array.isArray(files)) throw new TypeError("files must be an array of root-relative paths");

  const rootPath = path.resolve(root);
  const rootRealPath = await realpath(rootPath);
  const checkedFiles = [];
  const issues = [];

  for (const inputFile of files) {
    const original = String(inputFile);
    const sourcePath = path.resolve(rootPath, original);
    const sourceRelative = path.relative(rootPath, sourcePath);
    const file = posixPath(sourceRelative || ".");

    if (!isWithin(rootPath, sourcePath)) {
      addIssue(issues, posixPath(original), 1, original, "source-outside-root");
      continue;
    }

    let sourceRealPath;
    let markdown;
    try {
      sourceRealPath = await realpath(sourcePath);
      if (!isWithin(rootRealPath, sourceRealPath)) {
        addIssue(issues, file, 1, original, "source-outside-root");
        continue;
      }
      markdown = await readFile(sourceRealPath, "utf8");
    } catch (error) {
      addIssue(issues, file, 1, original, error?.code === "ENOENT" ? "missing-source" : "unreadable-source");
      continue;
    }

    checkedFiles.push(file);
    for (const { target, line } of destinationsIn(markdown)) {
      const localPath = localPathFrom(target);
      if (localPath === null) continue;
      if (localPath === false) {
        addIssue(issues, file, line, target, "invalid-target");
        continue;
      }

      const targetPath = path.resolve(path.dirname(sourcePath), localPath);
      if (!isWithin(rootPath, targetPath)) {
        addIssue(issues, file, line, target, "target-outside-root");
        continue;
      }

      try {
        const targetRealPath = await realpath(targetPath);
        if (!isWithin(rootRealPath, targetRealPath)) addIssue(issues, file, line, target, "target-outside-root");
      } catch (error) {
        addIssue(issues, file, line, target, error?.code === "ENOENT" ? "missing-target" : "unreadable-target");
      }
    }
  }

  return { checkedFiles, issues };
}
