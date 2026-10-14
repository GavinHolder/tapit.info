import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, getDb } from './db.js';
import { newId } from './password.js';
import type { User } from './auth';

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const MAX_BYTES = 5 * 1024 * 1024;

// Only raster images. SVG and HTML are refused on purpose: they can carry scripts.
// The type is decided from the file's own first bytes, never from the name or the browser's claim.
export function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: 'image/gif', ext: 'gif' };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export async function saveUpload(user: User, file: File): Promise<{ id: string; filename: string; mime: string; size: number }> {
  if (file.size > MAX_BYTES) throw Object.assign(new Error('That image is over 5 MB.'), { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw Object.assign(new Error('Only PNG, JPEG, GIF or WebP images can be attached.'), { status: 415 });
  const id = newId('att');
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, `${id}.${kind.ext}`), bytes, { flag: 'wx' });
  const filename = (file.name || 'image').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
  getDb().prepare('INSERT INTO attachments (id, message_id, uploaded_by, filename, mime, size, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)').run(id, user.id, filename, kind.mime, bytes.length, new Date().toISOString());
  return { id, filename, mime: kind.mime, size: bytes.length };
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

export async function readUpload(user: User, id: string): Promise<{ data: Uint8Array; mime: string; filename: string } | null> {
  if (!/^att_[A-Za-z0-9_-]+$/.test(id)) return null;
  const row = getDb().prepare('SELECT id, message_id, uploaded_by, filename, mime FROM attachments WHERE id = ?').get(id) as
    | { id: string; message_id: string | null; uploaded_by: string; filename: string; mime: string }
    | undefined;
  if (!row) return null;
  // An image that is not yet part of a message can only be seen by whoever uploaded it.
  if (!row.message_id && row.uploaded_by !== user.id) return null;
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, `${row.id}.${EXT[row.mime]}`));
    return { data: new Uint8Array(data), mime: row.mime, filename: row.filename };
  } catch {
    return null;
  }
}

// Deletes image files from disk (used when a comment with images is removed).
export async function removeUploads(files: { id: string; mime: string }[]): Promise<void> {
  for (const f of files) {
    if (!/^att_[A-Za-z0-9_-]+$/.test(f.id) || !EXT[f.mime]) continue;
    await fs.rm(path.join(UPLOAD_DIR, `${f.id}.${EXT[f.mime]}`), { force: true });
  }
}
