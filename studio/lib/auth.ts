import { cookies } from 'next/headers';
import { getDb } from './db.js';
import { newToken, sha256, verifyPassword, DUMMY_HASH } from './password.js';

export type Role = 'owner' | 'client';
export type User = { id: string; email: string; name: string; role: Role };

export const SESSION_COOKIE = 'studio_session';
const SESSION_DAYS = 14;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.STUDIO_COOKIE_SECURE === '1',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 3600
});

export async function startSession(userId: string) {
  const db = getDb();
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000);
  db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, now.toISOString(), expires.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
  store.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
}

// The only place that decides who is signed in. Called by pages and by every API route.
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.disabled, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`
    )
    .get(sha256(token)) as { id: string; email: string; name: string; role: Role; disabled: number; expires_at: string } | undefined;
  if (!row || row.disabled || new Date(row.expires_at) < new Date()) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

const json = (body: unknown, status: number) => Response.json(body, { status });

// Use at the top of every route handler:
//   const g = await guard(req, 'owner'); if (!g.ok) return g.res;
// Mutating requests must carry the x-studio header, which other websites cannot add (CSRF defence).
export async function guard(req: Request, role?: Role): Promise<{ ok: true; user: User } | { ok: false; res: Response }> {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.get('x-studio') !== '1') {
    return { ok: false, res: json({ error: 'Missing request header.' }, 403) };
  }
  const user = await getUser();
  if (!user) return { ok: false, res: json({ error: 'Please sign in.' }, 401) };
  if (role && user.role !== role) return { ok: false, res: json({ error: 'You do not have access to this.' }, 403) };
  return { ok: true, user };
}

export function requireCsrf(req: Request): Response | null {
  return req.headers.get('x-studio') === '1' ? null : json({ error: 'Missing request header.' }, 403);
}

// Login attempt limiting. Kept in memory: it resets when the server restarts, which is acceptable here.
type Bucket = { fails: number; first: number; lockedUntil: number };
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const buckets: Map<string, Bucket> = ((globalThis as unknown as { __loginBuckets?: Map<string, Bucket> }).__loginBuckets ??= new Map());

// The caller's address, only when we sit behind our own reverse proxy (Caddy) that sets it.
// Otherwise return null: an unknown address must never be shared as one bucket, or any
// visitor could lock everyone out by failing five times.
export function clientIp(req: Request): string | null {
  if (process.env.STUDIO_TRUST_PROXY === '1') {
    const fwd = req.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
  }
  return null;
}

// Which counters a login attempt belongs to.
// Behind the proxy: one per address, and one per address plus email, so someone elsewhere
// cannot lock the owner out. Without it: one per email.
export function loginKeys(req: Request, email: string): string[] {
  const ip = clientIp(req);
  return ip ? [`ip:${ip}`, `pair:${ip}:${email}`] : [`email:${email}`];
}

export function lockedFor(keys: string[]): number {
  const now = Date.now();
  let wait = 0;
  for (const k of keys) {
    const b = buckets.get(k);
    if (b && b.lockedUntil > now) wait = Math.max(wait, b.lockedUntil - now);
  }
  return wait;
}

export function recordFailure(keys: string[]) {
  const now = Date.now();
  for (const k of keys) {
    const b = buckets.get(k);
    if (!b || now - b.first > WINDOW_MS) buckets.set(k, { fails: 1, first: now, lockedUntil: 0 });
    else {
      b.fails += 1;
      if (b.fails >= MAX_FAILS) b.lockedUntil = now + WINDOW_MS;
    }
  }
}

export function clearFailures(keys: string[]) {
  keys.forEach((k) => buckets.delete(k));
}

export function checkLogin(email: string, password: string): { id: string } | null {
  const row = getDb().prepare('SELECT id, password_hash, disabled FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
    | { id: string; password_hash: string; disabled: number }
    | undefined;
  // Always do one hash comparison so unknown emails and wrong passwords take the same time.
  const ok = verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
  return row && ok && !row.disabled ? { id: row.id } : null;
}
