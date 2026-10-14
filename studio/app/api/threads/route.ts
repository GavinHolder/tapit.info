import { guard } from '@/lib/auth';
import { Problem, createThread, listThreads } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const u = new URL(req.url);
  const threads = listThreads(g.user, {
    kind: u.searchParams.get('kind') || undefined,
    status: u.searchParams.get('status') || undefined,
    targetType: u.searchParams.get('target_type') || undefined,
    targetId: u.searchParams.has('target_id') ? u.searchParams.get('target_id')! : undefined,
    q: u.searchParams.get('q') || undefined
  });
  return Response.json({ threads });
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = createThread(g.user, {
      kind: String(b.kind || 'comment'),
      targetType: String(b.targetType || ''),
      targetId: String(b.targetId ?? ''),
      title: String(b.title || ''),
      body: String(b.body || ''),
      attachmentIds: Array.isArray(b.attachmentIds) ? b.attachmentIds.map(String) : []
    });
    return Response.json({ id });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
