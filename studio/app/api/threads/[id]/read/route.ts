import { guard } from '@/lib/auth';
import { markRead } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  markRead(g.user, id);
  return Response.json({ ok: true });
}
