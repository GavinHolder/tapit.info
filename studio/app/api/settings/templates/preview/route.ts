import { guard } from '@/lib/auth';
import { SAMPLE_NOTIFY, cleanTemplates, renderInvite, renderNotify } from '@/lib/emailTemplate';
import { getMailConfig } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// Renders an email from the wording currently typed on the page (nothing is saved or sent).
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { kind?: string; sample?: string; templates?: Record<string, unknown> };
  const t = cleanTemplates(b.templates ?? {});
  const base = getMailConfig().publicUrl || 'https://studio.example.com';
  const r = b.kind === 'invite'
    ? renderInvite(t, { name: 'Sam', inviter: g.user.name, url: `${base}/invite/EXAMPLE-LINK`, days: 7 })
    : renderNotify(t, SAMPLE_NOTIFY(base, 'Sam', b.sample === 'one'));
  return Response.json(r);
}
