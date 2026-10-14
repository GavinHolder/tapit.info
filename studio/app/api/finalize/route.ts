import { guard } from '@/lib/auth';
import { finalize, flowWarnings, listHandoffs, preflight } from '@/lib/handoff';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  return Response.json({ pre: preflight(), flows: await flowWarnings(), handoffs: listHandoffs() });
}

export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return Response.json(await finalize(g.user, { note: String(b.note ?? ''), acknowledged: b.acknowledged === true }));
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status) return Response.json({ error: (e as Error).message }, { status });
    throw e;
  }
}
