import { guard } from '@/lib/auth';
import { createDecision, listDecisions } from '@/lib/decisions';
import { Problem } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json({ decisions: listDecisions(g.user) });
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = createDecision(g.user, { area: String(b.area ?? ''), title: String(b.title ?? ''), description: String(b.description ?? ''), options: b.options });
    return Response.json({ id });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
