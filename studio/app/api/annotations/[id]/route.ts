import { guard } from '@/lib/auth';
import { Problem, deleteAnnotation } from '@/lib/threads';
import { removeUploads } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  try {
    const files = deleteAnnotation(g.user, (await ctx.params).id);
    await removeUploads(files);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
