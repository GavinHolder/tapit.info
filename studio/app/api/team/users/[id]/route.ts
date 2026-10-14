import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

// Owner can switch an account off or on. Switching off also ends its sessions.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  if (id === g.user.id) return Response.json({ error: 'You cannot switch off your own account.' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { disabled?: boolean };
  const db = getDb();
  const res = db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(body.disabled ? 1 : 0, id);
  if (!res.changes) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (body.disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return Response.json({ ok: true });
}
