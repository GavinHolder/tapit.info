import { guard } from '@/lib/auth';
import { saveUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose an image to attach.' }, { status: 400 });
  try {
    return Response.json(await saveUpload(g.user, file));
  } catch (e) {
    const err = e as Error & { status?: number };
    return Response.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
