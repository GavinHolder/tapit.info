import { guard } from '@/lib/auth';
import { createUser, getDb } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const users = getDb().prepare('SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at').all();
  return Response.json({ users });
}

// The developer creates a login directly, with a password they choose or generate and pass on.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; role?: string; password?: string };
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 80);
  const role = b.role === 'owner' ? 'owner' : 'client';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!name) return Response.json({ error: 'Enter their name.' }, { status: 400 });
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return Response.json({ error: 'That person already has an account.' }, { status: 409 });
  try {
    const id = createUser(db, { email, name, role, password: String(b.password || '') });
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not create the account.' }, { status: 400 });
  }
}
