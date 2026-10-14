import { guard } from '@/lib/auth';
import { Problem, createAnnotation, listAnnotations } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const mockup = new URL(req.url).searchParams.get('mockup') || '';
  return Response.json({ annotations: listAnnotations(g.user, mockup) });
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = createAnnotation(g.user, {
      mockup: String(b.mockup || ''),
      kind: String(b.kind || ''),
      data: b.data,
      element: typeof b.element === 'string' ? b.element : undefined,
      body: String(b.body || ''),
      attachmentIds: Array.isArray(b.attachmentIds) ? b.attachmentIds.map(String) : []
    });
    return Response.json({ id });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
