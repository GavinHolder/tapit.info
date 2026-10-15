import nodemailer from 'nodemailer';
import { getDb } from './db.js';
import { newId } from './password.js';

// Optional email notifications through the owner's own SMTP server. Off unless STUDIO_SMTP_HOST is set.
// Messages are batched: someone who gets five replies in a few minutes gets one email, not five.
// A mail problem is logged and retried; it never stops a message from being saved.
export const mailEnabled = () => !!process.env.STUDIO_SMTP_HOST;
const delayMs = () => Math.max(0, Number(process.env.STUDIO_MAIL_DELAY_SECONDS ?? 120)) * 1000;
const baseUrl = () => (process.env.STUDIO_PUBLIC_URL || 'http://localhost:3100').replace(/\/$/, '');

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.STUDIO_SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.STUDIO_SMTP_HOST,
      port,
      secure: process.env.STUDIO_SMTP_SECURE === '1' || port === 465,
      auth: process.env.STUDIO_SMTP_USER ? { user: process.env.STUDIO_SMTP_USER, pass: process.env.STUDIO_SMTP_PASS || '' } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  return transport;
}

// Called after a message is saved. Notifies the people on the other side of the conversation.
export function enqueueNotifications(authorId: string, threadId: string, messageId: string) {
  if (!mailEnabled()) return;
  try {
    const db = getDb();
    const author = db.prepare('SELECT role FROM users WHERE id = ?').get(authorId) as { role: string } | undefined;
    if (!author) return;
    const targetRole = author.role === 'owner' ? 'client' : 'owner';
    const people = db.prepare('SELECT id FROM users WHERE role = ? AND disabled = 0 AND notify_email = 1 AND id != ?').all(targetRole, authorId) as { id: string }[];
    const now = new Date().toISOString();
    for (const p of people) db.prepare('INSERT INTO outbox (id, user_id, thread_id, message_id, created_at) VALUES (?, ?, ?, ?, ?)').run(newId('out'), p.id, threadId, messageId, now);
  } catch (e) {
    console.warn('[studio] Could not queue an email notification:', (e as Error).message);
  }
}

type Pending = { id: string; user_id: string; thread_id: string; message_id: string };

export async function flushMail(): Promise<number> {
  if (!mailEnabled()) return 0;
  const db = getDb();
  const cutoff = new Date(Date.now() - delayMs()).toISOString();
  const rows = db.prepare('SELECT id, user_id, thread_id, message_id FROM outbox WHERE sent_at IS NULL AND attempts < 5 AND created_at <= ? ORDER BY created_at').all(cutoff) as Pending[];
  if (!rows.length) return 0;
  const byUser = new Map<string, Pending[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  let sent = 0;
  for (const [userId, list] of byUser) {
    const u = db.prepare('SELECT email, name, notify_email, disabled FROM users WHERE id = ?').get(userId) as { email: string; name: string; notify_email: number; disabled: number } | undefined;
    const ids = list.map((r) => r.id);
    const mark = (sql: string) => { for (const id of ids) db.prepare(sql).run(new Date().toISOString(), id); };
    if (!u || u.disabled || !u.notify_email) { mark('UPDATE outbox SET sent_at = ? WHERE id = ?'); continue; }
    const threads = new Map<string, { title: string; count: number; last: string; who: string }>();
    for (const r of list) {
      const t = db.prepare('SELECT title FROM threads WHERE id = ?').get(r.thread_id) as { title: string } | undefined;
      const m = db.prepare('SELECT m.body, COALESCE(a.name, \'TapIt Studio\') AS who FROM messages m LEFT JOIN users a ON a.id = m.author_id WHERE m.id = ?').get(r.message_id) as { body: string; who: string } | undefined;
      if (!t || !m) continue;
      const cur = threads.get(r.thread_id);
      threads.set(r.thread_id, { title: t.title, count: (cur?.count ?? 0) + 1, last: m.body, who: m.who });
    }
    if (!threads.size) { mark('UPDATE outbox SET sent_at = ? WHERE id = ?'); continue; }
    const total = [...threads.values()].reduce((n, t) => n + t.count, 0);
    const lines = [`Hi ${u.name},`, '', `${total} new message${total === 1 ? '' : 's'} in TapIt Studio:`, ''];
    for (const [tid, t] of threads) {
      lines.push(`${t.title}${t.count > 1 ? ` (${t.count} messages)` : ''}`, `${t.who}: ${t.last.replace(/\s+/g, ' ').slice(0, 200)}${t.last.length > 200 ? '…' : ''}`, `${baseUrl()}/inbox?t=${tid}`, '');
    }
    lines.push('You get this email because notifications are on for your account. You can turn them off from the top bar in TapIt Studio.');
    try {
      await getTransport().sendMail({
        from: process.env.STUDIO_MAIL_FROM || process.env.STUDIO_SMTP_USER || 'studio@localhost',
        to: u.email,
        subject: total === 1 ? `TapIt Studio: ${[...threads.values()][0].title.slice(0, 80)}` : `TapIt Studio: ${total} new messages`,
        text: lines.join('\n')
      });
      mark('UPDATE outbox SET sent_at = ? WHERE id = ?');
      sent++;
    } catch (e) {
      for (const id of ids) db.prepare('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?').run(id);
      console.warn(`[studio] Email to ${u.email} failed (will retry): ${(e as Error).message}`);
    }
  }
  return sent;
}

export function startMailLoop() {
  const g = globalThis as { __studioMail?: boolean };
  if (g.__studioMail || !mailEnabled()) return;
  g.__studioMail = true;
  console.log(`[studio] Email notifications on (SMTP ${process.env.STUDIO_SMTP_HOST}).`);
  const t = setInterval(() => void flushMail().catch((e) => console.warn('[studio] Mail loop:', e.message)), Math.max(1000, Math.min(30000, delayMs() || 1000)));
  t.unref();
}
