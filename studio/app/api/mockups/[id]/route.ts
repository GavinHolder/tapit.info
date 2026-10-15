import { guard, requireCsrf } from '@/lib/auth';
import { commentCount, deleteMockup, getMockup, updateMockup } from '@/lib/mockups';
import { Problem } from '@/lib/threads';

export const dynamic = 'force-dynamic';

const wrap = async (fn: () => Promise<Response> | Response) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const id = (await ctx.params).id;
  const m = getMockup(id);
  if (!m) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ mockup: m, comments: commentCount(id) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const bad = requireCsrf(req);
  if (bad) return bad;
  return wrap(async () => Response.json({ mockup: updateMockup((await ctx.params).id, (await req.json().catch(() => ({}))) as Record<string, unknown>) }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const bad = requireCsrf(req);
  if (bad) return bad;
  return wrap(async () => Response.json({ ok: true, ...(await deleteMockup((await ctx.params).id)) }));
}
