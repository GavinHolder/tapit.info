import { guard } from '@/lib/auth';
import { explainMailError, sendRendered } from '@/lib/mail';
import { effectiveConfig, testAllowed } from '@/lib/mailTest';
import { getTemplates } from '@/lib/settings';
import { SAMPLE_NOTIFY, renderNotify } from '@/lib/emailTemplate';

export const dynamic = 'force-dynamic';

// Sends a real email using the settings as typed (saved or not), so you know they work before you rely on them.
export async function POST(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as { to?: string; config?: Record<string, unknown> };
  const to = String(b.to || g.user.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ error: 'Enter a valid email address to send the test to.' }, { status: 400 });
  const { cfg, problem } = effectiveConfig(b.config as never);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (!testAllowed()) return Response.json({ error: 'Too many tests in a minute. Wait a little and try again.' }, { status: 429 });
  try {
    const r = renderNotify(getTemplates(), SAMPLE_NOTIFY(cfg.publicUrl || 'http://localhost:3100', g.user.name));
    await sendRendered(cfg, to, { ...r, subject: `[Test] ${r.subject}` });
    return Response.json({ ok: true, sentTo: to });
  } catch (e) {
    return Response.json({ ok: false, error: explainMailError(e) }, { status: 200 });
  }
}
