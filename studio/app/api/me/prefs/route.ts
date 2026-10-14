import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { mailEnabled } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const row = getDb().prepare('SELECT notify_email FROM users WHERE id = ?').get(g.user.id) as { notify_email: number };
  return Response.json({ mailEnabled: mailEnabled(), notifyEmail: !!row.notify_email });
}

export async function PATCH(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { notifyEmail?: unknown };
  if (typeof b.notifyEmail !== 'boolean') return Response.json({ error: 'Send notifyEmail true or false.' }, { status: 400 });
  getDb().prepare('UPDATE users SET notify_email = ? WHERE id = ?').run(b.notifyEmail ? 1 : 0, g.user.id);
  return Response.json({ notifyEmail: b.notifyEmail });
}
