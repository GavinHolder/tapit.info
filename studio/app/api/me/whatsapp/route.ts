import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { confirmVerification, startVerification, waEnabled } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// Link, confirm or remove your WhatsApp number. A code is sent to the number and typed back here.
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { action?: string; phone?: string; code?: string };
  if (!waEnabled()) return Response.json({ error: 'WhatsApp is not set up on this server.' }, { status: 503 });
  const db = getDb();
  if (b.action === 'start') {
    try {
      const r = await startVerification(g.user.id, String(b.phone ?? ''));
      return Response.json({ sentTo: r.masked });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 500 });
    }
  }
  if (b.action === 'verify') {
    if (!confirmVerification(g.user.id, String(b.code ?? ''))) return Response.json({ error: 'That code is not right or has expired.' }, { status: 400 });
    return Response.json({ ok: true });
  }
  if (b.action === 'remove') {
    db.prepare('UPDATE users SET phone = NULL, phone_verified = 0, wa_code_hash = NULL, wa_code_expires = NULL, wa_code_tries = 0 WHERE id = ?').run(g.user.id);
    db.prepare('DELETE FROM wa_context WHERE user_id = ?').run(g.user.id);
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
