import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const users = getDb().prepare('SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at').all();
  return Response.json({ users });
}
