import { guard } from '@/lib/auth';
import { readFlows } from '@/lib/planning';
import { listMockups } from '@/lib/mockups';

export const dynamic = 'force-dynamic';

// Which flow steps use which mockup screen.
export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const protos = listMockups();
  const out: Record<string, { flow: string; flowTitle: string; step: string; title: string }[]> = {};
  for (const f of await readFlows()) {
    for (const n of f.nodes) {
      const ref = (n.data.mockup || '').toLowerCase();
      if (!ref) continue;
      const p = protos.find((x) => ref.includes(x.file.toLowerCase()) || ref === x.id.toLowerCase());
      if (p) (out[p.id] ||= []).push({ flow: f.id, flowTitle: f.title, step: n.id, title: n.data.title });
    }
  }
  return Response.json({ links: out });
}
