import fs from 'node:fs/promises';
import path from 'node:path';
import { guard } from '@/lib/auth';
import { Problem, deleteAnnotation } from '@/lib/threads';
import { UPLOAD_DIR } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  try {
    const files = deleteAnnotation(g.user, (await ctx.params).id);
    for (const f of files) await fs.rm(path.join(UPLOAD_DIR, `${f.id}.${EXT[f.mime]}`), { force: true });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
