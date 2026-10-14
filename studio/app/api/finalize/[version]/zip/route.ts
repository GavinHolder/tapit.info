import { guard } from '@/lib/auth';
import { handoffZip } from '@/lib/handoff';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ version: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const v = Number((await ctx.params).version);
  const z = Number.isInteger(v) ? await handoffZip(v) : null;
  if (!z) return Response.json({ error: 'Not found.' }, { status: 404 });
  return new Response(z.data as BodyInit, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${z.name}"`, 'x-content-type-options': 'nosniff' } });
}
