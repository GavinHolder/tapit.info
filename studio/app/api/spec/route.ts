import { guard } from '@/lib/auth';
import { readFlows, writeSpec } from '@/lib/planning';
import { buildSpec } from '@/lib/spec';

export const dynamic = 'force-dynamic';

// Rebuilds planning/SPEC.md from every flow and returns the text (owner only).
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const markdown = buildSpec(await readFlows());
  await writeSpec(markdown);
  return Response.json({ markdown, path: 'planning/SPEC.md' });
}

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json({ markdown: buildSpec(await readFlows()) });
}
