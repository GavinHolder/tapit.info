import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { mailEnabled } from '@/lib/mail';
import { maskPhone, waEnabled, waInboundEnabled } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

type Row = { notify_email: number; notify_whatsapp: number; phone: string | null; phone_verified: number };

function state(userId: string) {
  const r = getDb().prepare('SELECT notify_email, notify_whatsapp, phone, phone_verified FROM users WHERE id = ?').get(userId) as Row;
  return {
    mailEnabled: mailEnabled(),
    notifyEmail: !!r.notify_email,
    waEnabled: waEnabled(),
    waInbound: waInboundEnabled(),
    notifyWhatsapp: !!r.notify_whatsapp,
    phone: maskPhone(r.phone),
    phoneVerified: !!r.phone_verified
  };
}

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json(state(g.user.id));
}

export async function PATCH(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { notifyEmail?: unknown; notifyWhatsapp?: unknown };
  const db = getDb();
  let touched = false;
  if (b.notifyEmail !== undefined) {
    if (typeof b.notifyEmail !== 'boolean') return Response.json({ error: 'Send notifyEmail true or false.' }, { status: 400 });
    db.prepare('UPDATE users SET notify_email = ? WHERE id = ?').run(b.notifyEmail ? 1 : 0, g.user.id);
    touched = true;
  }
  if (b.notifyWhatsapp !== undefined) {
    if (typeof b.notifyWhatsapp !== 'boolean') return Response.json({ error: 'Send notifyWhatsapp true or false.' }, { status: 400 });
    db.prepare('UPDATE users SET notify_whatsapp = ? WHERE id = ?').run(b.notifyWhatsapp ? 1 : 0, g.user.id);
    touched = true;
  }
  if (!touched) return Response.json({ error: 'Nothing to change.' }, { status: 400 });
  return Response.json(state(g.user.id));
}
