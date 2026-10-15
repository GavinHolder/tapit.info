import { getDb } from './db.js';
import { decrypt, encrypt } from './secret';
import { TEMPLATE_DEFAULTS, TEMPLATE_KEYS, cleanTemplates, type Templates } from './emailTemplate';

export type Security = 'starttls' | 'ssl' | 'none';
export type MailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  security: Security;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
  publicUrl: string;
  delaySeconds: number;
  source: 'saved' | 'environment' | 'none';
};

function all(prefix: string): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings WHERE key LIKE ?').all(`${prefix}%`) as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key.slice(prefix.length), r.value]));
}

function put(key: string, value: string) {
  getDb().prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, new Date().toISOString());
}
const drop = (key: string) => getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);

// Settings saved in the app win. Without any, the old STUDIO_SMTP_* environment variables still work.
export function getMailConfig(): MailConfig {
  const s = all('mail.');
  const env = process.env;
  if (s.host !== undefined) {
    return {
      enabled: s.enabled !== '0',
      host: s.host,
      port: Number(s.port) || 587,
      security: (['starttls', 'ssl', 'none'] as const).includes(s.security as Security) ? (s.security as Security) : 'starttls',
      user: s.user ?? '',
      pass: s.pass ? (decrypt(s.pass) ?? '') : '',
      fromName: s.fromName ?? 'TapIt Studio',
      fromAddress: s.fromAddress ?? '',
      publicUrl: (s.publicUrl || env.STUDIO_PUBLIC_URL || 'http://localhost:3100').replace(/\/$/, ''),
      delaySeconds: Number(s.delay ?? 120),
      source: 'saved'
    };
  }
  if (env.STUDIO_SMTP_HOST) {
    const port = Number(env.STUDIO_SMTP_PORT || 587);
    return {
      enabled: true,
      host: env.STUDIO_SMTP_HOST,
      port,
      security: env.STUDIO_SMTP_SECURE === '1' || port === 465 ? 'ssl' : 'starttls',
      user: env.STUDIO_SMTP_USER || '',
      pass: env.STUDIO_SMTP_PASS || '',
      fromName: 'TapIt Studio',
      fromAddress: env.STUDIO_MAIL_FROM || '',
      publicUrl: (env.STUDIO_PUBLIC_URL || 'http://localhost:3100').replace(/\/$/, ''),
      delaySeconds: Number(env.STUDIO_NOTIFY_DELAY_SECONDS ?? env.STUDIO_MAIL_DELAY_SECONDS ?? 120),
      source: 'environment'
    };
  }
  return { enabled: false, host: '', port: 587, security: 'starttls', user: '', pass: '', fromName: 'TapIt Studio', fromAddress: '', publicUrl: (env.STUDIO_PUBLIC_URL || '').replace(/\/$/, ''), delaySeconds: 120, source: 'none' };
}

export type MailInput = {
  enabled?: boolean; host?: string; port?: number; security?: string; user?: string; password?: string; clearPassword?: boolean;
  fromName?: string; fromAddress?: string; publicUrl?: string; delaySeconds?: number;
};

export function validateMailInput(i: MailInput): string | null {
  if (i.host !== undefined && i.host.trim() && !/^[A-Za-z0-9.\-_:\[\]]+$/.test(i.host.trim())) return 'The server name looks wrong. Use something like smtp.example.com.';
  if (i.port !== undefined && (!Number.isInteger(i.port) || i.port < 1 || i.port > 65535)) return 'The port must be a number between 1 and 65535.';
  if (i.fromAddress && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(i.fromAddress.trim())) return 'The “from” address does not look like an email address.';
  if (i.publicUrl && !/^https?:\/\/[^\s]+$/.test(i.publicUrl.trim())) return 'The Studio address must start with http:// or https://';
  if (i.delaySeconds !== undefined && (!Number.isFinite(i.delaySeconds) || i.delaySeconds < 0 || i.delaySeconds > 3600)) return 'Wait time must be between 0 and 3600 seconds.';
  return null;
}

export function saveMailConfig(i: MailInput) {
  const cur = getMailConfig();
  put('mail.enabled', i.enabled === false ? '0' : '1');
  put('mail.host', (i.host ?? cur.host).trim());
  put('mail.port', String(i.port ?? cur.port));
  put('mail.security', (['starttls', 'ssl', 'none'].includes(String(i.security)) ? String(i.security) : cur.security));
  put('mail.user', (i.user ?? cur.user).trim());
  if (i.clearPassword) drop('mail.pass');
  else if (typeof i.password === 'string' && i.password !== '') put('mail.pass', encrypt(i.password));
  else if (cur.source !== 'saved' && cur.pass) put('mail.pass', encrypt(cur.pass)); // moving from environment settings keeps their password
  put('mail.fromName', (i.fromName ?? cur.fromName).trim() || 'TapIt Studio');
  put('mail.fromAddress', (i.fromAddress ?? cur.fromAddress).trim());
  put('mail.publicUrl', (i.publicUrl ?? cur.publicUrl).trim().replace(/\/$/, ''));
  put('mail.delay', String(i.delaySeconds ?? cur.delaySeconds));
}

export function hasSavedPassword(): boolean {
  return !!getMailConfig().pass;
}

export function getTemplates(): Templates {
  return cleanTemplates(all('tpl.'));
}

export function saveTemplates(input: Record<string, unknown>) {
  const t = cleanTemplates(input);
  for (const k of TEMPLATE_KEYS) {
    if (t[k] === TEMPLATE_DEFAULTS[k]) drop(`tpl.${k}`);
    else put(`tpl.${k}`, t[k]);
  }
}

export function resetTemplates() {
  getDb().prepare("DELETE FROM settings WHERE key LIKE 'tpl.%'").run();
}
