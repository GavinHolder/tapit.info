import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { newId, newToken, sha256 } from '@/lib/password.js';
import { mailEnabled, sendInviteEmail, explainMailError } from '@/lib/mail';

export const dynamic = 'force-dynamic';

const DAYS = 7;

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const invites = getDb()
    .prepare('SELECT id, email, name, role, created_at, expires_at, used_at FROM invites ORDER BY created_at DESC LIMIT 50')
    .all();
  return Response.json({ invites });
}

// Creates a one-time invite link. The token is shown once and only its hash is stored.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; role?: string; sendEmail?: boolean };
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const role = body.role === 'owner' ? 'owner' : 'client';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!name) return Response.json({ error: 'Enter their name.' }, { status: 400 });
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return Response.json({ error: 'That person already has an account.' }, { status: 409 });

  const token = newToken();
  const now = new Date();
  db.prepare('INSERT INTO invites (id, token_hash, email, name, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    newId('inv'),
    sha256(token),
    email,
    name,
    role,
    g.user.id,
    now.toISOString(),
    new Date(now.getTime() + DAYS * 24 * 3600 * 1000).toISOString()
  );
  // Optionally email the link as well (only when email is set up on the Settings page).
  let emailed: 'off' | 'sent' | 'failed' = 'off';
  let emailError = '';
  if (body.sendEmail && mailEnabled()) {
    try {
      await sendInviteEmail(email, name, g.user.name, `/invite/${token}`, DAYS);
      emailed = 'sent';
    } catch (e) {
      emailed = 'failed';
      emailError = explainMailError(e);
    }
  }
  return Response.json({ path: `/invite/${token}`, expiresInDays: DAYS, emailed, emailError });
}
