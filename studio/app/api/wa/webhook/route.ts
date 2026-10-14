import { getDb } from '@/lib/db.js';
import type { User } from '@/lib/auth';
import { Problem, addMessage } from '@/lib/threads';
import { logSend, publicUrl, sendText, underDailyCap, verifySignature, waInboundEnabled } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const DAY = 24 * 3600 * 1000;

// Receives WhatsApp messages from OpenWA. A reply from a linked number is added to the conversation
// it was last notified about. Strangers are ignored without an answer. Every request must carry a valid HMAC signature.
export async function POST(req: Request) {
  if (!waInboundEnabled()) return Response.json({ error: 'Not enabled.' }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 200_000 || !verifySignature(raw, req.headers.get('x-openwa-signature'))) return Response.json({ error: 'Bad signature.' }, { status: 401 });
  let evt: { event?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(raw); } catch { return Response.json({ error: 'Bad JSON.' }, { status: 400 }); }
  if (evt.event !== 'message.received' || !evt.data) return Response.json({ ok: true, ignored: 'event' });
  const d = evt.data;
  const db = getDb();

  const from = String(d.from ?? '');
  const type = typeof d.type === 'string' ? d.type : 'text';
  if (d.fromMe === true || from.endsWith('@g.us') || from.includes('broadcast') || !['text', 'chat'].includes(type)) return Response.json({ ok: true, ignored: 'kind' });

  const key = req.headers.get('x-openwa-idempotency-key') || `${d.id ?? ''}`;
  if (key) {
    const seen = db.prepare('INSERT OR IGNORE INTO wa_seen (key, at) VALUES (?, ?)').run(key, new Date().toISOString());
    if (!seen.changes) return Response.json({ ok: true, ignored: 'duplicate' });
    db.prepare('DELETE FROM wa_seen WHERE at < ?').run(new Date(Date.now() - 7 * DAY).toISOString());
  }

  // The sender's number. A privacy id (@lid) only works if OpenWA supplies senderPhone.
  const digits = (from.endsWith('@lid') ? String(d.senderPhone ?? '') : from.split('@')[0].split(':')[0]).replace(/\D/g, '');
  if (!digits) return Response.json({ ok: true, ignored: 'sender' });
  const u = db.prepare('SELECT id, email, name, role FROM users WHERE phone = ? AND phone_verified = 1 AND disabled = 0').get(digits) as User | undefined;
  if (!u) return Response.json({ ok: true, ignored: 'unknown number' });

  const body = String(d.body ?? '').trim();
  if (!body) return Response.json({ ok: true, ignored: 'empty' });

  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const inbound = (db.prepare("SELECT COUNT(*) AS n FROM wa_log WHERE user_id = ? AND kind = 'in' AND at > ?").get(u.id, since) as { n: number }).n;
  if (inbound >= 60) return Response.json({ ok: true, ignored: 'rate' });
  logSend(u.id, 'in');

  const say = async (text: string, kind: string) => {
    if (!underDailyCap(u.id, kind)) return;
    try { await sendText(digits, text); logSend(u.id, kind); } catch { /* the reply is a courtesy */ }
  };

  if (/^stop$/i.test(body)) {
    db.prepare('UPDATE users SET notify_whatsapp = 0 WHERE id = ?').run(u.id);
    await say('TapIt Studio: WhatsApp messages paused. Send START to turn them back on.', 'cmd');
    return Response.json({ ok: true, handled: 'stop' });
  }
  if (/^start$/i.test(body)) {
    db.prepare('UPDATE users SET notify_whatsapp = 1 WHERE id = ?').run(u.id);
    await say('TapIt Studio: WhatsApp messages are on again.', 'cmd');
    return Response.json({ ok: true, handled: 'start' });
  }

  const ctx = db.prepare('SELECT thread_id, at FROM wa_context WHERE user_id = ?').get(u.id) as { thread_id: string; at: string } | undefined;
  if (!ctx || Date.parse(ctx.at) < Date.now() - 2 * DAY) {
    const recent = (db.prepare("SELECT COUNT(*) AS n FROM wa_log WHERE user_id = ? AND kind = 'noctx' AND at > ?").get(u.id, since) as { n: number }).n;
    if (!recent) await say(`TapIt Studio: there is nothing to reply to right now. Open ${publicUrl()}/inbox to write a message.`, 'noctx');
    return Response.json({ ok: true, handled: 'no context' });
  }
  try {
    addMessage(u, ctx.thread_id, body.slice(0, 5000));
  } catch (e) {
    if (!(e instanceof Problem)) throw e;
    return Response.json({ ok: true, ignored: e.message });
  }
  return Response.json({ ok: true, handled: 'reply' });
}
