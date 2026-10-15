import { guard, requireCsrf } from '@/lib/auth';
import { hiddenBuiltins, importMockup, listMockups, MAX_IMAGE_BYTES } from '@/lib/mockups';
import { Problem } from '@/lib/threads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  return Response.json({ mockups: listMockups(), hidden: g.user.role === 'owner' ? hiddenBuiltins().map((p) => ({ id: p.id, title: p.title })) : [] });
}

// Developer only: import a mockup (an .html file or an image) while the app is running.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const bad = requireCsrf(req);
  if (bad) return bad;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new Problem(400, 'Choose a file to import.');
    if (file.size > MAX_IMAGE_BYTES) throw new Problem(413, 'That file is too large.');
    const num = (k: string) => (form.get(k) ? Number(form.get(k)) : undefined);
    const r = await importMockup(g.user, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      title: String(form.get('title') ?? ''),
      note: String(form.get('note') ?? ''),
      group: String(form.get('group') ?? ''),
      device: form.get('device') ? String(form.get('device')) : undefined,
      w: num('w'),
      h: num('h')
    });
    return Response.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
