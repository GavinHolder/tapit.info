import { guard, requireCsrf } from '@/lib/auth';
import { restoreBuiltins } from '@/lib/mockups';

export const dynamic = 'force-dynamic';

// Brings back every built-in mockup that was deleted (the id in the path is ignored; use "all").
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const bad = requireCsrf(req);
  if (bad) return bad;
  return Response.json({ restored: restoreBuiltins() });
}
