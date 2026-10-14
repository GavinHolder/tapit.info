import { guard } from '@/lib/auth';
import { respond } from '@/lib/decisions';
import { Problem } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    respond(g.user, (await ctx.params).id, { action: String(b.action ?? ''), option: typeof b.option === 'string' ? b.option : undefined, message: typeof b.message === 'string' ? b.message : undefined });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
