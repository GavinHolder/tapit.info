import { requireCsrf, startSession } from '@/lib/auth';
import { createUser, getDb } from '@/lib/db.js';
import { checkPasswordStrength, sha256 } from '@/lib/password.js';

export const dynamic = 'force-dynamic';

type InviteRow = { id: string; email: string; name: string; role: 'owner' | 'client'; expires_at: string; used_at: string | null; phone: string | null; phone_sent: number };

function find(token: string): InviteRow | undefined {
  const row = getDb().prepare('SELECT id, email, name, role, expires_at, used_at, phone, phone_sent FROM invites WHERE token_hash = ?').get(sha256(token)) as InviteRow | undefined;
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return undefined;
  return row;
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const inv = find(token);
  if (!inv) return Response.json({ error: 'This invite link is not valid any more. Ask for a new one.' }, { status: 404 });
  return Response.json({ name: inv.name, email: inv.email, role: inv.role });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const { token } = await ctx.params;
  const inv = find(token);
  if (!inv) return Response.json({ error: 'This invite link is not valid any more. Ask for a new one.' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password || '');
  const problem = checkPasswordStrength(password);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const db = getDb();
  const userId = createUser(db, { email: inv.email, name: inv.name, role: inv.role, password });
  db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(new Date().toISOString(), inv.id);
  // A link that reached them on WhatsApp proves the number is theirs.
  if (inv.phone && !db.prepare('SELECT 1 FROM users WHERE phone = ? AND phone_verified = 1').get(inv.phone)) {
    db.prepare('UPDATE users SET phone = ?, phone_verified = ? WHERE id = ?').run(inv.phone, inv.phone_sent ? 1 : 0, userId);
  }
  await startSession(userId);
  return Response.json({ ok: true });
}
