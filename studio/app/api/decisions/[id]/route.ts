import { guard } from '@/lib/auth';
import { deleteDecision, updateDecision } from '@/lib/decisions';
import { Problem } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    updateDecision(g.user, (await ctx.params).id, {
      area: typeof b.area === 'string' ? b.area : undefined,
      title: typeof b.title === 'string' ? b.title : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      options: b.options,
      status: typeof b.status === 'string' ? b.status : undefined
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  try {
    deleteDecision(g.user, (await ctx.params).id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
