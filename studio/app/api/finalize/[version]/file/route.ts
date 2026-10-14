import { guard } from '@/lib/auth';
import { readHandoffFile } from '@/lib/handoff';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ version: string }> }) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const v = Number((await ctx.params).version);
  const which = new URL(req.url).searchParams.get('name');
  const name = which === 'design' ? 'CLAUDE_DESIGN_PROMPT.md' : which === 'code' ? 'CLAUDE_CODE_PROMPT.md' : null;
  const text = name && Number.isInteger(v) ? await readHandoffFile(v, name) : null;
  if (text === null) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ text });
}
