// Studio database: users, invites, sessions (and later threads, messages, uploads).
// Uses Node's built-in SQLite, stored in a data folder that is NOT part of the repo.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, newId, checkPasswordStrength } from './password.js';

export const DATA_DIR = process.env.STUDIO_DATA_DIR || path.resolve(process.cwd(), 'data');
const PLANNING_DIR = process.env.PLANNING_DIR || path.resolve(process.cwd(), '..', 'planning');

// Each entry runs once, in order. Never edit an old entry; add a new one.
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'client')),
    password_hash TEXT NOT NULL,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'client')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  `,
  `
  CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('question', 'comment')),
    target_type TEXT NOT NULL CHECK (target_type IN ('project', 'flow', 'step', 'mockup')),
    target_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    question_id TEXT UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0,
    section TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    context_json TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX threads_target ON threads(target_type, target_id);
  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id TEXT REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX messages_thread ON messages(thread_id, created_at);
  CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE thread_reads (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TEXT NOT NULL,
    PRIMARY KEY (thread_id, user_id)
  );
  `,
  `
  CREATE TABLE annotations (
    thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
    mockup TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('pin', 'draw', 'box')),
    data TEXT NOT NULL,
    element TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX annotations_mockup ON annotations(mockup);
  `,
  `
  CREATE TABLE handoffs (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    folder TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    stats_json TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    seed_id TEXT UNIQUE,
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    options_json TEXT NOT NULL DEFAULT '[]',
    chosen TEXT,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'changes', 'superseded')),
    thread_id TEXT REFERENCES threads(id),
    sort INTEGER NOT NULL DEFAULT 0,
    decided_by TEXT REFERENCES users(id),
    decided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;
  CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX outbox_pending ON outbox(sent_at, created_at);
  `,
  `
  -- Reserved: these columns came from a WhatsApp experiment that was removed from this planning app.
  -- They are unused. The migration stays so databases that already ran it keep a consistent version number.
  ALTER TABLE users ADD COLUMN phone TEXT;
  ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN notify_whatsapp INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN wa_code_hash TEXT;
  ALTER TABLE users ADD COLUMN wa_code_expires TEXT;
  ALTER TABLE users ADD COLUMN wa_code_tries INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE outbox ADD COLUMN channel TEXT NOT NULL DEFAULT 'email';
  ALTER TABLE invites ADD COLUMN phone TEXT;
  ALTER TABLE invites ADD COLUMN phone_sent INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE wa_context (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    at TEXT NOT NULL
  );
  CREATE TABLE wa_seen (
    key TEXT PRIMARY KEY,
    at TEXT NOT NULL
  );
  CREATE TABLE wa_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    kind TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX wa_log_user ON wa_log(user_id, kind, at);
  `
];

function migrate(db) {
  const row = db.prepare('PRAGMA user_version').get();
  let version = row.user_version;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

export function createUser(db, { email, name, role, password }) {
  const problem = checkPasswordStrength(password);
  if (problem) throw new Error(problem);
  const id = newId('usr');
  db.prepare('INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    email.trim().toLowerCase(),
    name.trim() || email,
    role,
    hashPassword(password),
    new Date().toISOString()
  );
  return id;
}

function bootstrapOwner(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;
  const email = process.env.STUDIO_OWNER_EMAIL;
  const password = process.env.STUDIO_OWNER_PASSWORD;
  if (!email || !password) {
    console.warn('[studio] No users yet. Set STUDIO_OWNER_EMAIL and STUDIO_OWNER_PASSWORD, or run `npm run create-owner`.');
    return;
  }
  createUser(db, { email, name: process.env.STUDIO_OWNER_NAME || 'Owner', role: 'owner', password });
  console.log(`[studio] Created the owner account for ${email}.`);
}

// Creates one question thread per entry in planning/questions.json. Safe to run every start:
// a question that already has a thread is left alone, so answers are never touched.
export function seedQuestions(db) {
  const file = path.join(PLANNING_DIR, 'questions.json');
  if (!fs.existsSync(file)) return 0;
  const questions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const exists = db.prepare('SELECT 1 FROM threads WHERE question_id = ?');
  const insertThread = db.prepare(
    `INSERT INTO threads (id, kind, target_type, target_id, title, question_id, sort, section, priority, context_json, status, created_by, created_at, updated_at)
     VALUES (?, 'question', 'project', '', ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?)`
  );
  const insertMessage = db.prepare('INSERT INTO messages (id, thread_id, author_id, body, created_at) VALUES (?, ?, NULL, ?, ?)');
  let added = 0;
  const now = new Date().toISOString();
  for (const q of questions) {
    if (exists.get(q.id)) continue;
    const id = newId('thr');
    insertThread.run(id, q.text.slice(0, 200), q.id, q.num, q.section, q.priority === 'first' ? 1 : 0, JSON.stringify({ why: q.why || '', related: q.related || [], text: q.text }), now, now);
    insertMessage.run(newId('msg'), id, q.text, now);
    added += 1;
  }
  if (added) console.log(`[studio] Added ${added} client questions from planning/questions.json.`);
  return added;
}

// Creates the starting design decisions from planning/decisions.json. Existing ones are left alone.
export function seedDecisions(db) {
  const file = path.join(PLANNING_DIR, 'decisions.json');
  if (!fs.existsSync(file)) return 0;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const exists = db.prepare('SELECT 1 FROM decisions WHERE seed_id = ?');
  let added = 0;
  const now = new Date().toISOString();
  list.forEach((d, i) => {
    if (exists.get(d.id)) return;
    const tid = newId('thr');
    db.prepare(
      `INSERT INTO threads (id, kind, target_type, target_id, title, sort, status, created_by, created_at, updated_at)
       VALUES (?, 'comment', 'project', '', ?, 0, 'open', NULL, ?, ?)`
    ).run(tid, `Decision: ${d.title}`.slice(0, 200), now, now);
    db.prepare('INSERT INTO messages (id, thread_id, author_id, body, created_at) VALUES (?, ?, NULL, ?, ?)').run(newId('msg'), tid, `Decision: ${d.title}. ${d.description}`, now);
    db.prepare(
      `INSERT INTO decisions (id, seed_id, area, title, description, options_json, thread_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId('dec'), d.id, d.area, d.title, d.description || '', JSON.stringify(d.options || []), tid, i + 1, now, now);
    added += 1;
  });
  if (added) console.log(`[studio] Added ${added} design decisions from planning/decisions.json.`);
  return added;
}

export function openDb(dir = DATA_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'studio.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

// One connection per server process, kept across dev hot reloads.
export function getDb() {
  const g = globalThis;
  if (!g.__studioDb) {
    g.__studioDb = openDb();
    bootstrapOwner(g.__studioDb);
    seedQuestions(g.__studioDb);
    seedDecisions(g.__studioDb);
  }
  return g.__studioDb;
}
