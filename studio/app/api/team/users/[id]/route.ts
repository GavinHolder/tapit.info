import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { checkPasswordStrength, hashPassword } from '@/lib/password.js';

export const dynamic = 'force-dynamic';

// The developer can switch an account off or on, set a new password for it, or change its role.
// Switching off or changing the password also ends that person's sessions.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  if (id === g.user.id) return Response.json({ error: 'Use the Password button in the top bar for your own account. You cannot switch yourself off or change your own role.' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { disabled?: boolean; password?: string; role?: string };
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (body.password !== undefined) {
    const problem = checkPasswordStrength(String(body.password));
    if (problem) return Response.json({ error: problem }, { status: 400 });
    db.prepare('UPDATE users SET password_hash = ?, disabled = 0 WHERE id = ?').run(hashPassword(String(body.password)), id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (body.role !== undefined) {
    if (body.role !== 'owner' && body.role !== 'client') return Response.json({ error: 'Unknown role.' }, { status: 400 });
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (body.disabled !== undefined) {
    db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(body.disabled ? 1 : 0, id);
    if (body.disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  return Response.json({ ok: true });
}
