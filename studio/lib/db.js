// Studio database: users, invites, sessions (and later threads, messages, uploads).
// Uses Node's built-in SQLite, stored in a data folder that is NOT part of the repo.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, newId, checkPasswordStrength } from './password.js';

export const DATA_DIR = process.env.STUDIO_DATA_DIR || path.resolve(process.cwd(), 'data');

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
  }
  return g.__studioDb;
}
