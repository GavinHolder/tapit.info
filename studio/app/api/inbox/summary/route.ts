import { guard } from '@/lib/auth';
import { summary } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json(summary(g.user));
}
