import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';

// Secrets saved from the settings page (the SMTP password) are encrypted before they reach the database.
// The key is created once and kept in the data folder (studio/data/secret.key), so a backup of the data folder
// restores both. Anyone who can read that folder can read the secrets: protect it like the database itself.
function key(): Buffer {
  const file = path.join(DATA_DIR, 'secret.key');
  try {
    return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const k = crypto.randomBytes(32);
    fs.writeFileSync(file, k.toString('base64'), { mode: 0o600, flag: 'wx' });
    return k;
  }
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(':');
    if (v !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
