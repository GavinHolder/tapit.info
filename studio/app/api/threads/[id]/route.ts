import { guard } from '@/lib/auth';
import { Problem, getThread, setStatus } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    return Response.json(getThread(g.user, id));
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

// Only the developer decides when a thread is resolved or reopened.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { status?: string };
  try {
    setStatus(id, String(b.status || ''));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
