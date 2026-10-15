import nodemailer from 'nodemailer';
import { getDb } from './db.js';
import { newId } from './password.js';
import { getMailConfig, getTemplates, type MailConfig } from './settings';
import { renderInvite, renderNotify, type Rendered } from './emailTemplate';

// Email notifications through the owner's own SMTP server, set up on the Settings page.
// Messages are batched: someone who gets five replies in a few minutes gets one email, not five.
// A mail problem is logged and retried; it never stops a message from being saved.
export const mailEnabled = () => {
  const c = getMailConfig();
  return c.enabled && !!c.host;
};

type Transport = ReturnType<typeof nodemailer.createTransport>;
let cached: { key: string; t: Transport } | null = null;
function transportFor(cfg: MailConfig): Transport {
  const key = JSON.stringify([cfg.host, cfg.port, cfg.security, cfg.user, cfg.pass]);
  if (cached?.key === key) return cached.t;
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === 'ssl',
    requireTLS: cfg.security === 'starttls' && cfg.source === 'saved',
    ignoreTLS: cfg.security === 'none',
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  cached = { key, t };
  return t;
}

const fromOf = (cfg: MailConfig) => ({ name: cfg.fromName || 'TapIt Studio', address: cfg.fromAddress || (cfg.user.includes('@') ? cfg.user : 'studio@localhost') });

export async function sendRendered(cfg: MailConfig, to: string, r: Rendered): Promise<void> {
  await transportFor(cfg).sendMail({ from: fromOf(cfg), to, subject: r.subject, text: r.text, html: r.html });
}

// A readable reason for the settings page (never includes the password).
export function explainMailError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const msg = String(err.message ?? '');
  if (/ECONNREFUSED/.test(msg)) return 'Could not connect: nothing is listening on that server and port.';
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return 'The server name was not found. Check the spelling.';
  if (err.code === 'EAUTH' || err.responseCode === 535) return 'The server refused the username or password.';
  if (err.code === 'ECONNREFUSED') return 'Could not connect: nothing is listening on that server and port.';
  if (err.code === 'ENOTFOUND' || err.code === 'EDNS') return 'The server name was not found. Check the spelling.';
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'ECONNECTION') return 'The connection timed out or was closed. Check the server, the port and the security setting.';
  if (err.code === 'ECONNRESET') return 'The server closed the connection. The security setting is probably wrong for this port (try SSL on 465, STARTTLS on 587).';
  if (err.responseCode && err.responseCode >= 500) return `The server rejected the message (${err.responseCode}). ${String(err.message ?? '').replace(cfgPassGuard(), '').slice(0, 160)}`;
  return String(err.message ?? 'Could not send the email.').slice(0, 200);
}
const cfgPassGuard = () => { const p = getMailConfig().pass; return p ? new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/; };

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
    for (const p of people) db.prepare("INSERT INTO outbox (id, user_id, thread_id, message_id, created_at, channel) VALUES (?, ?, ?, ?, ?, 'email')").run(newId('out'), p.id, threadId, messageId, now);
  } catch (e) {
    console.warn('[studio] Could not queue an email notification:', (e as Error).message);
  }
}

type Pending = { id: string; user_id: string; thread_id: string; message_id: string };

export async function flushMail(): Promise<number> {
  const cfg = getMailConfig();
  if (!cfg.enabled || !cfg.host) return 0;
  const db = getDb();
  const cutoff = new Date(Date.now() - Math.max(0, cfg.delaySeconds) * 1000).toISOString();
  const rows = db.prepare("SELECT id, user_id, thread_id, message_id FROM outbox WHERE channel = 'email' AND sent_at IS NULL AND attempts < 5 AND created_at <= ? ORDER BY created_at").all(cutoff) as Pending[];
  if (!rows.length) return 0;
  const tpl = getTemplates();
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
      const m = db.prepare("SELECT m.body, COALESCE(a.name, 'TapIt Studio') AS who FROM messages m LEFT JOIN users a ON a.id = m.author_id WHERE m.id = ?").get(r.message_id) as { body: string; who: string } | undefined;
      if (!t || !m) continue;
      const cur = threads.get(r.thread_id);
      threads.set(r.thread_id, { title: t.title, count: (cur?.count ?? 0) + 1, last: m.body, who: m.who });
    }
    if (!threads.size) { mark('UPDATE outbox SET sent_at = ? WHERE id = ?'); continue; }
    const items = [...threads].slice(0, 8).map(([tid, t]) => ({
      title: t.title.slice(0, 120), count: t.count, who: t.who,
      last: `${t.last.replace(/\s+/g, ' ').slice(0, 200)}${t.last.length > 200 ? '…' : ''}`, url: `${cfg.publicUrl}/inbox?t=${tid}`
    }));
    try {
      await sendRendered(cfg, u.email, renderNotify(tpl, { name: u.name, items }));
      mark('UPDATE outbox SET sent_at = ? WHERE id = ?');
      sent++;
    } catch (e) {
      for (const id of ids) db.prepare('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?').run(id);
      console.warn(`[studio] Email to ${u.email} failed (will retry): ${explainMailError(e)}`);
    }
  }
  return sent;
}

export async function sendInviteEmail(to: string, name: string, inviter: string, path: string, days: number): Promise<void> {
  const cfg = getMailConfig();
  await sendRendered(cfg, to, renderInvite(getTemplates(), { name, inviter, url: `${cfg.publicUrl}${path}`, days }));
}

// Runs for the life of the server and checks the settings each time, so turning email on in Settings needs no restart.
export function startMailLoop() {
  const g = globalThis as { __studioMail?: boolean };
  if (g.__studioMail) return;
  g.__studioMail = true;
  const t = setInterval(() => void flushMail().catch((e) => console.warn('[studio] Mail loop:', (e as Error).message)), 5000);
  t.unref();
}
