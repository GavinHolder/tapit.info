import crypto from 'node:crypto';
import { getDb } from './db.js';

// Optional WhatsApp messages through your own OpenWA gateway (https://github.com/rmyndharis/OpenWA).
// Off unless STUDIO_WA_URL, STUDIO_WA_API_KEY and STUDIO_WA_SESSION are all set.
// OpenWA is an unofficial gateway: use a dedicated number and keep email as a fallback.
export const waEnabled = () => !!(process.env.STUDIO_WA_URL && process.env.STUDIO_WA_API_KEY && process.env.STUDIO_WA_SESSION);
export const waInboundEnabled = () => waEnabled() && (process.env.STUDIO_WA_WEBHOOK_SECRET || '').length >= 16;
export const publicUrl = () => (process.env.STUDIO_PUBLIC_URL || 'http://localhost:3100').replace(/\/$/, '');
const maxPerDay = () => Math.max(1, Number(process.env.STUDIO_WA_MAX_PER_DAY ?? 30));
const country = () => (process.env.STUDIO_WA_DEFAULT_COUNTRY || '27').replace(/\D/g, '');

// "082 123 4567", "+27 82 123 4567", "0027821234567" all become "27821234567".
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s().-]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = country() + d.slice(1);
  if (!/^\d{8,15}$/.test(d)) return null;
  return d;
}

export const maskPhone = (p: string | null) => (p ? `+${p.slice(0, 2)}…${p.slice(-3)}` : '');

export async function sendText(phone: string, text: string): Promise<void> {
  const base = (process.env.STUDIO_WA_URL as string).replace(/\/$/, '');
  const res = await fetch(`${base}/api/sessions/${encodeURIComponent(process.env.STUDIO_WA_SESSION as string)}/messages/send-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.STUDIO_WA_API_KEY as string },
    body: JSON.stringify({ chatId: `${phone}@c.us`, text }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`OpenWA answered ${res.status}`);
}

// A cap per person per day, so a busy day can never look like spam to WhatsApp.
export function underDailyCap(userId: string | null, kind: string): boolean {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const n = (getDb().prepare('SELECT COUNT(*) AS n FROM wa_log WHERE user_id IS ? AND kind = ? AND at > ?').get(userId, kind, since) as { n: number }).n;
  return n < maxPerDay();
}
export const logSend = (userId: string | null, kind: string) => getDb().prepare('INSERT INTO wa_log (user_id, kind, at) VALUES (?, ?, ?)').run(userId, kind, new Date().toISOString());

export function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.STUDIO_WA_WEBHOOK_SECRET || '';
  if (secret.length < 16 || !header) return false;
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(want), b = Buffer.from(header.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Number verification: a 6-digit code sent to the number, typed back in Studio ----
const hashCode = (c: string) => crypto.createHash('sha256').update(c + (process.env.STUDIO_WA_WEBHOOK_SECRET || 'studio')).digest('hex');

export async function startVerification(userId: string, phoneInput: string): Promise<{ masked: string }> {
  if (!waEnabled()) throw Object.assign(new Error('WhatsApp is not set up on this server.'), { status: 503 });
  const phone = normalizePhone(phoneInput);
  if (!phone) throw Object.assign(new Error('Enter a valid mobile number, for example 082 123 4567 or +27 82 123 4567.'), { status: 400 });
  const db = getDb();
  const taken = db.prepare('SELECT 1 FROM users WHERE phone = ? AND phone_verified = 1 AND id != ?').get(phone, userId);
  if (taken) throw Object.assign(new Error('That number is already linked to another account.'), { status: 409 });
  if (!underDailyCap(userId, 'code') ) throw Object.assign(new Error('Too many codes requested today. Try again tomorrow.'), { status: 429 });
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare('UPDATE users SET phone = ?, phone_verified = 0, wa_code_hash = ?, wa_code_expires = ?, wa_code_tries = 0 WHERE id = ?').run(phone, hashCode(code), new Date(Date.now() + 10 * 60 * 1000).toISOString(), userId);
  try {
    await sendText(phone, `TapIt Studio code: ${code}\nIt works for 10 minutes. If you did not ask for this, ignore it.`);
  } catch {
    throw Object.assign(new Error('Could not reach WhatsApp just now. Try again in a minute.'), { status: 502 });
  }
  logSend(userId, 'code');
  return { masked: maskPhone(phone) };
}

export function confirmVerification(userId: string, code: string): boolean {
  const db = getDb();
  const u = db.prepare('SELECT wa_code_hash, wa_code_expires, wa_code_tries FROM users WHERE id = ?').get(userId) as { wa_code_hash: string | null; wa_code_expires: string | null; wa_code_tries: number };
  if (!u.wa_code_hash || !u.wa_code_expires || u.wa_code_expires < new Date().toISOString() || u.wa_code_tries >= 5) return false;
  db.prepare('UPDATE users SET wa_code_tries = wa_code_tries + 1 WHERE id = ?').run(userId);
  if (hashCode(code.trim()) !== u.wa_code_hash) return false;
  db.prepare('UPDATE users SET phone_verified = 1, wa_code_hash = NULL, wa_code_expires = NULL, wa_code_tries = 0 WHERE id = ?').run(userId);
  return true;
}

export const setContext = (userId: string, threadId: string) =>
  getDb().prepare('INSERT INTO wa_context (user_id, thread_id, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET thread_id = excluded.thread_id, at = excluded.at').run(userId, threadId, new Date().toISOString());

// ---- Outgoing digests (called by the notification loop) ----
type Pending = { id: string; user_id: string; thread_id: string; message_id: string };

export async function flushWhatsApp(cutoffIso: string): Promise<number> {
  if (!waEnabled()) return 0;
  const db = getDb();
  const rows = db.prepare("SELECT id, user_id, thread_id, message_id FROM outbox WHERE channel = 'whatsapp' AND sent_at IS NULL AND attempts < 5 AND created_at <= ? ORDER BY created_at").all(cutoffIso) as Pending[];
  const byUser = new Map<string, Pending[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  let sent = 0;
  for (const [userId, list] of byUser) {
    const markAll = () => { for (const r of list) db.prepare('UPDATE outbox SET sent_at = ? WHERE id = ?').run(new Date().toISOString(), r.id); };
    const u = db.prepare('SELECT name, phone, phone_verified, notify_whatsapp, disabled FROM users WHERE id = ?').get(userId) as { name: string; phone: string | null; phone_verified: number; notify_whatsapp: number; disabled: number } | undefined;
    if (!u || u.disabled || !u.phone || !u.phone_verified || !u.notify_whatsapp) { markAll(); continue; }
    if (!underDailyCap(userId, 'digest')) { markAll(); console.warn(`[studio] WhatsApp daily limit reached for ${u.name}; skipped (email and the inbox still work).`); continue; }
    const threads = new Map<string, { title: string; count: number; last: string; who: string }>();
    for (const r of list) {
      const t = db.prepare('SELECT title FROM threads WHERE id = ?').get(r.thread_id) as { title: string } | undefined;
      const m = db.prepare("SELECT m.body, COALESCE(a.name, 'TapIt Studio') AS who FROM messages m LEFT JOIN users a ON a.id = m.author_id WHERE m.id = ?").get(r.message_id) as { body: string; who: string } | undefined;
      if (!t || !m) continue;
      threads.set(r.thread_id, { title: t.title, count: (threads.get(r.thread_id)?.count ?? 0) + 1, last: m.body, who: m.who });
    }
    if (!threads.size) { markAll(); continue; }
    const total = [...threads.values()].reduce((n, t) => n + t.count, 0);
    const lastThread = [...threads.keys()].pop() as string;
    const lines = [`TapIt Studio: ${total} new message${total === 1 ? '' : 's'}`, ''];
    for (const t of [...threads.values()].slice(0, 5)) lines.push(`*${t.title.slice(0, 70)}*`, `${t.who}: ${t.last.replace(/\s+/g, ' ').slice(0, 160)}${t.last.length > 160 ? '…' : ''}`, '');
    if (threads.size > 5) lines.push(`…and ${threads.size - 5} more`, '');
    lines.push(`Open: ${publicUrl()}/inbox?t=${lastThread}`);
    if (waInboundEnabled()) lines.push('Reply here to answer the latest one. Send STOP to pause these.');
    try {
      await sendText(u.phone, lines.join('\n'));
      setContext(userId, lastThread);
      logSend(userId, 'digest');
      markAll();
      sent++;
    } catch (e) {
      for (const r of list) db.prepare('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?').run(r.id);
      console.warn(`[studio] WhatsApp to ${u.name} failed (will retry): ${(e as Error).message}`);
    }
  }
  return sent;
}
