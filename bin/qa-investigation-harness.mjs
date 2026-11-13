#!/usr/bin/env node
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const clients = new Map([
  ['claude', '.claude'],
  ['codex', '.agents'],
  ['copilot', '.github'],
]);
const usage = 'Usage: qa-investigation-harness install --client <claude|codex|copilot>';

function* bundledFiles(source, destination) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) yield* bundledFiles(from, to);
    else if (entry.isFile()) yield [to, readFileSync(from)];
    else throw new Error('Unsupported bundle entry: ' + from);
  }
}

function pendingWrite(root, relative, contents) {
  const parts = relative.split(/[\\/]/);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const existing = lstatSync(current, { throwIfNoEntry: false });
    if (!existing) return true;
    if (index < parts.length - 1 && existing.isDirectory()) continue;
    if (index === parts.length - 1 && existing.isFile() && readFileSync(current).equals(contents)) return false;
    throw new Error('Install would overwrite or traverse an existing path: ' + current);
  }
}

function install(client) {
  const project = resolve(process.cwd());
  const files = [
    ...bundledFiles(join(packageRoot, 'qa-harness'), 'qa-harness'),
    ...bundledFiles(join(packageRoot, '.agents', 'skills'), join(clients.get(client), 'skills')),
  ];
  const pending = files.filter(([relative, contents]) => pendingWrite(project, relative, contents));
  for (const [relative, contents] of pending) {
    const destination = join(project, relative);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents, { flag: 'wx' });
  }
  console.log('QA harness for ' + client + ': ' + pending.length + ' files added in ' + project);
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(usage);
  else if (args.length === 3 && args[0] === 'install' && args[1] === '--client' && clients.has(args[2])) install(args[2]);
  else throw new Error(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
