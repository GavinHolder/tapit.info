#!/usr/bin/env node
// Carries your own work from an OLD TapIt folder into a NEW one, so a new zip never costs you anything.
//
//   node update-studio.mjs "D:\Projects\2026\tapit\tapit.info-studio-v0" "D:\Projects\2026\tapit\tapit.info-studio-v3"
//
// If you run it from inside the new folder you can leave out the second path:
//   node update-studio.mjs "D:\path\to\old-folder"
//
// What it copies from OLD into NEW:
//   studio/data/            database (accounts, messages, decisions), uploaded images
//   studio/.env*            your settings
//   planning/flows/         flows you edited in Studio (the new zip's copy is kept as <name>.incoming if different)
//   planning/handoffs/      every handoff you finalized
//   .idea/                  your WebStorm project settings (only if NEW has none)
// Anything it would overwrite is first saved to NEW/_update-backup-<time>/.
// It never changes or deletes anything in the OLD folder. Stop the dev server before running it.
//
// Options: --dry (show what would happen), --force (replace a database NEW already has, after backing it up),
//          --install (run "npm install" in NEW/studio when done)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const paths = args.filter((a) => !a.startsWith('--'));
const DRY = flags.has('--dry');
const FORCE = flags.has('--force');

const here = path.dirname(fileURLToPath(import.meta.url));
const die = (m) => { console.error(`\nStopped: ${m}\n`); process.exit(1); };

// A folder may be the project root (has studio/) or the studio folder itself.
function resolveRoot(p) {
  const abs = path.resolve(p);
  if (fs.existsSync(path.join(abs, 'studio', 'package.json'))) return abs;
  if (fs.existsSync(path.join(abs, 'package.json')) && path.basename(abs) === 'studio') return path.dirname(abs);
  // Zips often unpack to one extra folder level.
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(abs, e.name, 'studio', 'package.json'))) return path.join(abs, e.name);
    }
  }
  return null;
}

if (!paths.length) die('Give the path of the OLD folder. Example:\n  node update-studio.mjs "D:\\Projects\\tapit\\old-folder" "D:\\Projects\\tapit\\new-folder"');
const OLD = resolveRoot(paths[0]);
const NEW = resolveRoot(paths[1] ?? here);
if (!OLD) die(`"${paths[0]}" does not look like a TapIt folder (no studio\\package.json inside).`);
if (!NEW) die(`The new folder was not found (no studio\\package.json). Give its path as the second argument.`);
if (path.resolve(OLD) === path.resolve(NEW)) die('The old and new folders are the same. Extract the new zip into a NEW folder first.');

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const BACKUP = path.join(NEW, `_update-backup-${stamp}`);
const log = [];
const note = (s) => { log.push(s); console.log(s); };

const same = (a, b) => {
  try { const x = fs.readFileSync(a), y = fs.readFileSync(b); return x.equals(y); } catch { return false; }
};

function backup(file) {
  if (!fs.existsSync(file)) return;
  const rel = path.relative(NEW, file);
  const dest = path.join(BACKUP, rel);
  if (DRY) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}

// Copy one file, saving whatever it replaces. Returns what happened.
function copyFile(src, dst, { keepIncoming = false } = {}) {
  if (fs.existsSync(dst)) {
    if (same(src, dst)) return 'same';
    if (keepIncoming) {
      if (!DRY) fs.copyFileSync(dst, dst + '.incoming');
      if (!DRY) fs.copyFileSync(src, dst);
      return 'replaced (the new zip version is saved as ' + path.basename(dst) + '.incoming)';
    }
    backup(dst);
  }
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  return 'copied';
}

function copyTree(srcDir, dstDir, opts) {
  let n = 0;
  if (!fs.existsSync(srcDir)) return n;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name), d = path.join(dstDir, e.name);
    if (e.isDirectory()) n += copyTree(s, d, opts);
    else if (copyFile(s, d, opts) !== 'same') n++;
  }
  return n;
}

console.log(`\nOld: ${OLD}\nNew: ${NEW}${DRY ? '\n(dry run: nothing will be changed)' : ''}\n`);

// 1. Database and uploads
const oldData = path.join(OLD, 'studio', 'data');
const newData = path.join(NEW, 'studio', 'data');
if (fs.existsSync(oldData)) {
  const wal = path.join(oldData, 'studio.db-wal');
  if (fs.existsSync(wal) && fs.statSync(wal).size > 0) note('Warning: the old database has unsaved changes in a side file. They are copied too, but stop the old dev server so nothing changes while this runs.');
  const newDb = path.join(newData, 'studio.db');
  if (fs.existsSync(newDb) && !same(path.join(oldData, 'studio.db'), newDb)) {
    if (!FORCE) die('The new folder already has its own database (you started it once). Nothing was copied.\nIf you want your OLD data to replace it, run again with --force (the new one is backed up first).');
    for (const f of ['studio.db', 'studio.db-wal', 'studio.db-shm']) backup(path.join(newData, f));
    if (!DRY) for (const f of ['studio.db-wal', 'studio.db-shm']) fs.rmSync(path.join(newData, f), { force: true });
    note(`Existing new database backed up to ${path.relative(NEW, BACKUP)}.`);
  }
  const n = copyTree(oldData, newData, {});
  note(`Data: ${n} file(s) copied (database, uploaded images).`);
} else {
  note('Data: the old folder has no studio\\data yet (nothing to copy).');
}

// 2. Settings
let envCount = 0;
for (const f of fs.existsSync(path.join(OLD, 'studio')) ? fs.readdirSync(path.join(OLD, 'studio')) : []) {
  if (/^\.env(\..+)?$/.test(f) && f !== '.env.example') {
    if (copyFile(path.join(OLD, 'studio', f), path.join(NEW, 'studio', f)) !== 'same') envCount++;
  }
}
note(`Settings: ${envCount} .env file(s) copied.`);

// 3. Flows you edited
const oldFlows = path.join(OLD, 'planning', 'flows');
let flows = 0, incoming = 0;
if (fs.existsSync(oldFlows)) {
  for (const f of fs.readdirSync(oldFlows).filter((x) => x.endsWith('.flow.json'))) {
    const r = copyFile(path.join(oldFlows, f), path.join(NEW, 'planning', 'flows', f), { keepIncoming: true });
    if (r !== 'same') flows++;
    if (r.startsWith('replaced')) incoming++;
  }
}
note(`Flows: ${flows} changed file(s) carried over${incoming ? `; ${incoming} had a different version in the new zip (saved next to it as .incoming)` : ''}.`);

// 4. Handoffs
const h = copyTree(path.join(OLD, 'planning', 'handoffs'), path.join(NEW, 'planning', 'handoffs'), {});
note(`Handoffs: ${h} file(s) copied.`);

// 5. WebStorm settings
if (fs.existsSync(path.join(OLD, '.idea')) && !fs.existsSync(path.join(NEW, '.idea'))) {
  const n = copyTree(path.join(OLD, '.idea'), path.join(NEW, '.idea'), {});
  note(`WebStorm: ${n} settings file(s) copied.`);
}

if (!DRY && fs.existsSync(BACKUP)) note(`\nAnything that was replaced is saved in ${BACKUP}`);

console.log('\nDone.' + (DRY ? ' (dry run, nothing was changed)' : ''));
if (flags.has('--install') && !DRY) {
  console.log('\nRunning npm install in the new studio folder...\n');
  const r = spawnSync('npm', ['install'], { cwd: path.join(NEW, 'studio'), stdio: 'inherit', shell: true });
  if (r.status !== 0) die('npm install failed. Run it yourself in the new studio folder.');
}
console.log(`\nNext:\n  cd "${path.join(NEW, 'studio')}"\n${flags.has('--install') ? '' : '  npm install\n'}  npm run dev\nYour existing accounts and data are already in place, so you sign in as before.\n`);
