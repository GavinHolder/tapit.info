import { guard } from '@/lib/auth';
import { readUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const file = await readUpload(g.user, id);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.data as BodyInit, {
    headers: {
      'content-type': file.mime,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; sandbox",
      'content-disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`,
      'cache-control': 'private, max-age=3600'
    }
  });
}
