import { guard } from '@/lib/auth';
import { TEMPLATE_DEFAULTS } from '@/lib/emailTemplate';
import { getTemplates, resetTemplates, saveTemplates } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  return Response.json({ templates: getTemplates(), defaults: TEMPLATE_DEFAULTS });
}

export async function PUT(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { templates?: Record<string, unknown> };
  saveTemplates(b.templates ?? {});
  return Response.json({ templates: getTemplates() });
}

export async function DELETE(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  resetTemplates();
  return Response.json({ templates: getTemplates() });
}
