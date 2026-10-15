import { clearFailures, guard, lockedFor, recordFailure, startSession } from '@/lib/auth';
import { getDb } from '@/lib/db.js';
import { checkPasswordStrength, hashPassword, verifyPassword } from '@/lib/password.js';

export const dynamic = 'force-dynamic';

// Change your own password. Needs the current one, so someone at an unlocked screen cannot take over the account.
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const keys = [`pw:${g.user.id}`];
  const wait = lockedFor(keys);
  if (wait > 0) return Response.json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minutes.` }, { status: 429 });
  const db = getDb();
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(g.user.id) as { password_hash: string };
  if (!verifyPassword(String(b.current ?? ''), row.password_hash)) {
    recordFailure(keys);
    return Response.json({ error: 'Your current password is not right.' }, { status: 400 });
  }
  const problem = checkPasswordStrength(String(b.next ?? ''));
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (b.next === b.current) return Response.json({ error: 'Choose a different password.' }, { status: 400 });
  clearFailures(keys);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(b.next)), g.user.id);
  // Sign out everywhere else (including anyone who knew the old password), then keep this browser signed in.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(g.user.id);
  await startSession(g.user.id);
  return Response.json({ ok: true });
}
