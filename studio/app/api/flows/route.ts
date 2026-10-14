import { guard } from '@/lib/auth';
import { listFlows, writeFlow } from '@/lib/planning';
import type { Flow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json(await listFlows());
}

// Only the owner can create flows.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = (body.title || '').trim();
  if (!title) return Response.json({ error: 'title required' }, { status: 400 });
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'flow';
  const flow: Flow = { id, title, description: '', nodes: [], edges: [] };
  await writeFlow(flow);
  return Response.json(flow);
}
