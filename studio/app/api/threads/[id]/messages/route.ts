import { guard } from '@/lib/auth';
import { Problem, addMessage } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { body?: string; attachmentIds?: unknown };
  try {
    const out = addMessage(g.user, id, String(b.body || ''), Array.isArray(b.attachmentIds) ? b.attachmentIds.map(String) : []);
    return Response.json(out);
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
