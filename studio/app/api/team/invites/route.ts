import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { newId, newToken, sha256 } from '@/lib/password.js';
import { normalizePhone, publicUrl, sendText, waEnabled } from '@/lib/whatsapp';

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
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; role?: string; phone?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const role = body.role === 'owner' ? 'owner' : 'client';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!name) return Response.json({ error: 'Enter their name.' }, { status: 400 });
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return Response.json({ error: 'That person already has an account.' }, { status: 409 });

  const phoneRaw = String(body.phone || '').trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return Response.json({ error: 'That mobile number does not look right.' }, { status: 400 });
  const token = newToken();
  const now = new Date();
  const invId = newId('inv');
  db.prepare('INSERT INTO invites (id, token_hash, email, name, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    invId,
    sha256(token),
    email,
    name,
    role,
    g.user.id,
    now.toISOString(),
    new Date(now.getTime() + DAYS * 24 * 3600 * 1000).toISOString()
  );
  // Optionally deliver the link on WhatsApp. If it arrives, that also proves the number is theirs.
  let whatsapp: 'off' | 'sent' | 'failed' = 'off';
  if (phone && waEnabled()) {
    try {
      await sendText(phone, `Hi ${name}, ${g.user.name} has invited you to TapIt Studio, where we plan TapIt together.\n\nOpen this link to set your password (valid for ${DAYS} days):\n${publicUrl()}/invite/${token}`);
      whatsapp = 'sent';
      db.prepare('UPDATE invites SET phone = ?, phone_sent = 1 WHERE id = ?').run(phone, invId);
    } catch {
      whatsapp = 'failed';
      db.prepare('UPDATE invites SET phone = ?, phone_sent = 0 WHERE id = ?').run(phone, invId);
    }
  }
  return Response.json({ path: `/invite/${token}`, expiresInDays: DAYS, whatsapp });
}
