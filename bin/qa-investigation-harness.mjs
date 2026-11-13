#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const metadataPath = '.qa-investigation-harness/installer-state.json';
const clients = new Map([
  ['claude', '.claude'],
  ['codex', '.agents'],
  ['copilot', '.github'],
]);
const usage = 'Usage: qa-investigation-harness <install|upgrade> --client <claude|codex|copilot> [--accept-local <path>]';

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

function validVersion(version) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

function packageVersion() {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  if (!validVersion(manifest.version)) {
    throw new Error('Package version is invalid');
  }
  return manifest.version;
}

function fileHash(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function portablePath(relative) {
  return relative.replace(/\\/g, '/');
}

function isManagedPath(relative) {
  const normalized = portablePath(relative);
  return normalized.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes(':'))
    && (normalized.startsWith('qa-harness/') || /^\.(claude|agents|github)\/skills\/.+/.test(normalized));
}

function preflightPath(root, relative) {
  if (typeof relative !== 'string' || !relative || isAbsolute(relative) || relative.startsWith('/') || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..' || part.includes(':'))) {
    throw new Error('Invalid installer state path: ' + relative);
  }
  let current = root;
  const parts = relative.split(/[\\/]/);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const existing = lstatSync(current, { throwIfNoEntry: false });
    if (!existing) return false;
    if (existing.isSymbolicLink()) throw new Error('Install will not traverse a symbolic link: ' + current);
    if (index < parts.length - 1 && existing.isDirectory()) continue;
    if (index === parts.length - 1 && existing.isFile()) return true;
    throw new Error('Install path is not a regular file or directory: ' + current);
  }
  return false;
}

function readState(project) {
  const exists = preflightPath(project, metadataPath);
  if (!exists) return { schemaVersion: 1, packageVersion: null, files: {} };
  let state;
  try {
    state = JSON.parse(readFileSync(join(project, metadataPath), 'utf8'));
  } catch {
    throw new Error('Installer state is invalid; preserve it and review ' + metadataPath);
  }
  if (state?.schemaVersion !== 1 || (state.packageVersion !== null && !validVersion(state.packageVersion)) || !state.files || typeof state.files !== 'object' || Array.isArray(state.files)) {
    throw new Error('Installer state is invalid; preserve it and review ' + metadataPath);
  }
  for (const [relative, record] of Object.entries(state.files)) {
    if (!isManagedPath(relative)) throw new Error('Installer state contains an unmanaged path: ' + relative);
    preflightPath(project, relative);
    if (!record || !validVersion(record.version) || !/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) {
      throw new Error('Installer state is invalid for ' + relative + '; preserve it and review ' + metadataPath);
    }
  }
  return state;
}

function writeState(project, state) {
  preflightPath(project, metadataPath);
  const destination = join(project, metadataPath);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = destination + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
  try {
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function installerFiles(client) {
  return [
    ...bundledFiles(join(packageRoot, 'qa-harness'), 'qa-harness'),
    ...bundledFiles(join(packageRoot, '.agents', 'skills'), join(clients.get(client), 'skills')),
  ];
}

function stateRecord(version, contents) {
  return { version, sha256: fileHash(contents) };
}

function writeManagedFile(project, relative, contents, replace = false) {
  const destination = join(project, relative);
  mkdirSync(dirname(destination), { recursive: true });
  if (!replace) {
    writeFileSync(destination, contents, { flag: 'wx' });
    return;
  }
  const temporary = destination + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, contents, { flag: 'wx' });
  try {
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function legacyBaseline() {
  const baselineFile = join(packageRoot, 'bin', 'upgrade-baselines', '0.1.0.json');
  if (!lstatSync(baselineFile, { throwIfNoEntry: false })) return null;
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
  } catch {
    throw new Error('Packaged 0.1.0 upgrade baseline is invalid');
  }
  if (baseline?.version !== '0.1.0' || !baseline.files || typeof baseline.files !== 'object' || Array.isArray(baseline.files)) {
    throw new Error('Packaged 0.1.0 upgrade baseline is invalid');
  }
  for (const [relative, hash] of Object.entries(baseline.files)) {
    if (!/^(qa-harness\/.+|skills\/.+)$/.test(relative) || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error('Packaged 0.1.0 upgrade baseline is invalid for ' + relative);
    }
  }
  return baseline.files;
}

function legacyHash(relative, client, baseline) {
  const normalized = portablePath(relative);
  const skillsPrefix = clients.get(client) + '/skills/';
  const key = normalized.startsWith(skillsPrefix) ? 'skills/' + normalized.slice(skillsPrefix.length) : normalized;
  return baseline?.[key] ?? null;
}

function upgrade(client, acceptLocal) {
  const project = resolve(process.cwd());
  const version = packageVersion();
  const state = readState(project);
  const baseline = state.packageVersion === null ? legacyBaseline() : null;
  const files = installerFiles(client);
  const byPath = new Map(files.map(([relative, contents]) => [portablePath(relative), { relative, contents }]));
  const accepted = acceptLocal ? portablePath(acceptLocal) : null;
  if (accepted && (!isManagedPath(accepted) || !byPath.has(accepted))) {
    throw new Error('--accept-local must name a shared or selected-client harness file');
  }
  if (accepted && !preflightPath(project, accepted)) throw new Error('--accept-local requires an existing file: ' + accepted);

  if (baseline && state.packageVersion === null) {
    for (const [key, hash] of Object.entries(baseline)) {
      const relative = key.startsWith('skills/')
        ? portablePath(join(clients.get(client), 'skills', key.slice('skills/'.length)))
        : key;
      if (!state.files[relative]) state.files[relative] = { version: '0.1.0', sha256: hash };
    }
    state.packageVersion = '0.1.0';
  }

  preflightPath(project, metadataPath);
  const decisions = [];
  const obsolete = [];
  for (const [relative, { contents }] of byPath) {
    const exists = preflightPath(project, relative);
    const current = exists ? readFileSync(join(project, relative)) : null;
    const currentHash = current ? fileHash(current) : null;
    const desiredHash = fileHash(contents);
    const record = state.files[relative];
    const previousHash = record?.sha256 ?? legacyHash(relative, client, baseline);
    const isAccepted = accepted === relative;
    const action = !exists ? 'add'
      : isAccepted ? 'accept'
        : currentHash === desiredHash ? 'same'
          : previousHash && currentHash === previousHash ? 'update'
            : 'conflict';
    let conflictPath = null;
    if (action === 'conflict') {
      conflictPath = portablePath(join('.qa-investigation-harness', 'conflicts', version, relative));
      const conflictExists = preflightPath(project, conflictPath);
      if (conflictExists && !readFileSync(join(project, conflictPath)).equals(contents)) conflictPath = null;
    }
    decisions.push({ relative, contents, current, action, conflictPath, desiredHash });
  }

  const knownPaths = new Set(byPath.keys());
  const previousPaths = new Map(Object.entries(state.files));
  if (baseline) {
    for (const [key, hash] of Object.entries(baseline)) {
      const relative = key.startsWith('skills/')
        ? portablePath(join(clients.get(client), 'skills', key.slice('skills/'.length)))
        : key;
      if (!knownPaths.has(relative)) previousPaths.set(relative, { version: '0.1.0', sha256: hash });
    }
  }
  for (const [relative, record] of previousPaths) {
    if (knownPaths.has(relative) || !isManagedPath(relative)) continue;
    const belongsToClient = relative.startsWith('qa-harness/') || relative.startsWith(clients.get(client) + '/skills/');
    if (!belongsToClient || !preflightPath(project, relative)) continue;
    obsolete.push(relative);
  }

  for (const { relative, action } of decisions) {
    if (action === 'conflict') {
      const conflictPath = portablePath(join('.qa-investigation-harness', 'conflicts', version, relative));
      preflightPath(project, conflictPath);
    }
  }

  const summary = { added: [], updated: [], unchanged: [], accepted: [], conflicts: [], obsolete };
  for (const decision of decisions) {
    const { relative, contents, action, conflictPath, desiredHash } = decision;
    if (action === 'conflict') {
      const outputPath = portablePath(join('.qa-investigation-harness', 'conflicts', version, relative));
      const exists = preflightPath(project, outputPath);
      if (!exists) writeManagedFile(project, outputPath, contents);
      summary.conflicts.push({ relative, copy: outputPath, collision: conflictPath === null });
      continue;
    }

    if (action === 'add') {
      writeManagedFile(project, relative, contents);
      summary.added.push(relative);
      state.files[relative] = stateRecord(version, contents);
    } else if (action === 'update') {
      writeManagedFile(project, relative, contents, true);
      summary.updated.push(relative);
      state.files[relative] = stateRecord(version, contents);
    } else if (action === 'accept') {
      summary.accepted.push(relative);
      state.files[relative] = stateRecord(version, decision.current);
    } else {
      summary.unchanged.push(relative);
      state.files[relative] = stateRecord(version, contents);
    }
    state.packageVersion = version;
    writeState(project, state);
  }

  state.packageVersion = version;
  writeState(project, state);
  console.log('QA harness upgrade for ' + client + ': ' + summary.updated.length + ' updated, ' + summary.added.length + ' added, ' + summary.unchanged.length + ' unchanged, ' + summary.accepted.length + ' accepted, ' + summary.conflicts.length + ' conflicts, ' + summary.obsolete.length + ' obsolete.');
  for (const item of summary.conflicts) {
    console.log('Preserved local file: ' + item.relative + '; upstream copy: ' + item.copy + (item.collision ? ' (copy already exists and differs)' : ''));
  }
  for (const relative of summary.obsolete) console.log('Preserved obsolete upstream file: ' + relative);
  return summary.conflicts.length > 0 || summary.obsolete.length > 0;
}

function install(client) {
  const project = resolve(process.cwd());
  const version = packageVersion();
  const state = readState(project);
  const files = installerFiles(client);
  const pending = files.filter(([relative, contents]) => pendingWrite(project, relative, contents));
  preflightPath(project, metadataPath);
  for (const [relative, contents] of pending) {
    const destination = join(project, relative);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents, { flag: 'wx' });
  }
  for (const [relative, contents] of files) state.files[portablePath(relative)] = stateRecord(version, contents);
  state.packageVersion = version;
  writeState(project, state);
  console.log('QA harness for ' + client + ': ' + pending.length + ' files added in ' + project);
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(usage);
  else if (args.length === 3 && args[0] === 'install' && args[1] === '--client' && clients.has(args[2])) install(args[2]);
  else if (args.length === 3 && args[0] === 'upgrade' && args[1] === '--client' && clients.has(args[2])) {
    if (upgrade(args[2])) process.exitCode = 2;
  }
  else if (args.length === 5 && args[0] === 'upgrade' && args[1] === '--client' && clients.has(args[2]) && args[3] === '--accept-local') {
    if (upgrade(args[2], args[4])) process.exitCode = 2;
  }
  else throw new Error(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
