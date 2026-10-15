import { guard } from '@/lib/auth';
import { SAMPLE_NOTIFY, cleanTemplates, renderInvite, renderNotify } from '@/lib/emailTemplate';
import { explainMailError, sendRendered } from '@/lib/mail';
import { effectiveConfig, testAllowed } from '@/lib/mailTest';

export const dynamic = 'force-dynamic';

// Sends the notification or invitation email, with the wording currently typed, to the address you give.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { kind?: string; to?: string; templates?: Record<string, unknown> };
  const to = String(b.to || g.user.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const { cfg } = effectiveConfig(undefined);
  if (!cfg.host) return Response.json({ error: 'Set up the mail server first (Email connection above).' }, { status: 400 });
  if (!testAllowed()) return Response.json({ error: 'Too many tests in a minute. Wait a little and try again.' }, { status: 429 });
  const t = cleanTemplates(b.templates ?? {});
  const base = cfg.publicUrl || 'http://localhost:3100';
  const r = b.kind === 'invite'
    ? renderInvite(t, { name: g.user.name, inviter: g.user.name, url: `${base}/invite/EXAMPLE-LINK`, days: 7 })
    : renderNotify(t, SAMPLE_NOTIFY(base, g.user.name));
  try {
    await sendRendered(cfg, to, { ...r, subject: `[Test] ${r.subject}` });
    return Response.json({ ok: true, sentTo: to });
  } catch (e) {
    return Response.json({ ok: false, error: explainMailError(e) });
  }
}
