import { guard } from '@/lib/auth';
import { readFlow, writeFlow } from '@/lib/planning';
import type { Flow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    return Response.json(await readFlow(id));
  } catch {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}

// Only the owner can change flows. Clients discuss them in threads instead.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const flow = (await req.json().catch(() => null)) as Flow | null;
  if (!flow || flow.id !== id || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    return Response.json({ error: 'bad flow' }, { status: 400 });
  }
  try {
    await writeFlow(flow);
    return Response.json({ ok: true, savedAt: Date.now() });
  } catch {
    return Response.json({ error: 'could not save' }, { status: 500 });
  }
}
