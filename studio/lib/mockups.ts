import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, getDb } from './db.js';
import { newId } from './password.js';
import { BUILTIN, type Prototype } from './prototypes';
import { Problem } from './threads';
import { removeUploads, sniffImage } from './uploads';
import type { User } from './auth';

export const MOCKUP_DIR = path.join(DATA_DIR, 'mockups');
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Row = { id: string; title: string; note: string; group_name: string; kind: 'dc' | 'html' | 'image'; mime: string | null; device: 'phone' | 'desktop'; w: number; h: number; created_at: string };

const toProto = (r: Row): Prototype => ({ id: r.id, file: `u-${r.id}.html`, title: r.title, note: r.note, w: r.w, h: r.h, device: r.device, group: r.group_name, kind: r.kind, createdAt: r.created_at });

function hiddenIds(): Set<string> {
  return new Set((getDb().prepare('SELECT id FROM mockups_hidden').all() as { id: string }[]).map((r) => r.id));
}

/** Everything a person can review: the built-in boards that are not hidden, then the imported ones, oldest first. */
export function listMockups(): Prototype[] {
  const hidden = hiddenIds();
  const imported = (getDb().prepare('SELECT * FROM mockups ORDER BY created_at, rowid').all() as Row[]).map(toProto);
  return [...BUILTIN.filter((p) => !hidden.has(p.id)), ...imported];
}

export function hiddenBuiltins(): Prototype[] {
  const hidden = hiddenIds();
  return BUILTIN.filter((p) => hidden.has(p.id));
}

export function getMockup(id: string): Prototype | undefined {
  return listMockups().find((p) => p.id === id);
}

export const isMockupId = (id: string) => listMockups().some((p) => p.id === id);

export function commentCount(id: string): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM threads WHERE target_type = 'mockup' AND target_id = ?").get(id) as { n: number }).n;
}

const clamp = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= lo ? Math.min(v, hi) : dflt;
};

function clean(input: { title?: unknown; note?: unknown; group?: unknown; device?: unknown; w?: unknown; h?: unknown }, base?: Row) {
  const title = String(input.title ?? base?.title ?? '').trim().slice(0, 100);
  if (!title) throw new Problem(400, 'Give the mockup a name.');
  const device = (input.device ?? base?.device ?? 'desktop') === 'phone' ? 'phone' : 'desktop';
  const group = String(input.group ?? base?.group_name ?? 'Imported').trim().slice(0, 60) || 'Imported';
  const note = String(input.note ?? base?.note ?? '').trim().slice(0, 300);
  const w = clamp(input.w ?? base?.w, 200, 4000, device === 'phone' ? 390 : 1280);
  const h = clamp(input.h ?? base?.h, 200, 12000, device === 'phone' ? 844 : 800);
  return { title, device, group, note, w, h };
}

type Inspected = { kind: 'dc' | 'html' | 'image'; mime: string | null; text?: string; w?: number; h?: number; warnings: string[] };

/** Decides what a file is from its content, never from its name. */
export function inspect(bytes: Uint8Array): Inspected {
  const img = sniffImage(bytes);
  if (img) {
    if (bytes.length > MAX_IMAGE_BYTES) throw new Problem(413, 'That image is over 10 MB.');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let w: number | undefined, h: number | undefined;
    if (img.mime === 'image/png' && bytes.length > 24) { w = dv.getUint32(16); h = dv.getUint32(20); }
    if (img.mime === 'image/gif' && bytes.length > 10) { w = dv.getUint16(6, true); h = dv.getUint16(8, true); }
    return { kind: 'image', mime: img.mime, w, h, warnings: [] };
  }
  if (bytes.length > MAX_HTML_BYTES) throw new Problem(413, 'That file is over 5 MB.');
  if (bytes.includes(0)) throw new Problem(415, 'That does not look like a mockup. Import an .html file or a PNG, JPEG, GIF or WebP image.');
  const text = new TextDecoder('utf-8').decode(bytes);
  if (!/<(!doctype|html|body|head|div|x-dc|svg|main|section)\b/i.test(text)) throw new Problem(415, 'That does not look like a mockup. Import an .html file or a PNG, JPEG, GIF or WebP image.');
  if (/^\s*<svg\b/i.test(text) && !/<html/i.test(text)) throw new Problem(415, 'SVG files are not accepted because they can carry scripts. Export the mockup as PNG or HTML instead.');
  const warnings: string[] = [];
  let out = text;
  const isDc = /<x-dc\b/i.test(text) || /support\.js/.test(text);
  // Make it work offline: swap Google Fonts for the bundled copy.
  const fonts = /<link[^>]+href=["']https?:\/\/fonts\.googleapis\.com[^>]*>/gi;
  if (fonts.test(out)) {
    out = out.replace(/<link[^>]+rel=["']preconnect["'][^>]*>\s*/gi, '').replace(fonts, '<link href="./fonts/fonts.css" rel="stylesheet">');
    warnings.push('Google Fonts were swapped for the fonts bundled with Studio (Manrope, Bricolage Grotesque, Figtree).');
  }
  const external = new Set<string>();
  for (const m of out.matchAll(/<(?:script|link|img|iframe|source|video|audio)\b[^>]*?\s(?:src|href)=["'](https?:)?\/\/([^/"'\s]+)/gi)) external.add(m[2]);
  for (const m of out.matchAll(/url\(\s*["']?(?:https?:)?\/\/([^/"')\s]+)/gi)) external.add(m[1]);
  if (external.size) warnings.push(`It loads from outside (${[...external].slice(0, 4).join(', ')}). Studio blocks outside requests, so those parts will be missing. Include them in the file instead.`);
  let w: number | undefined, h: number | undefined;
  const pv = out.match(/"\$preview"\s*:\s*(\{[^}]*\})/)?.[1];
  const pw = pv?.match(/"width"\s*:\s*(\d+)/)?.[1], ph = pv?.match(/"height"\s*:\s*(\d+)/)?.[1];
  if (pw && ph) { w = Number(pw); h = Number(ph); }
  const vp = out.match(/width\s*:\s*(\d{3,4})px\s*;\s*height\s*:\s*(\d{3,5})px/);
  if (!(pw && ph) && vp) { w = Number(vp[1]); h = Number(vp[2]); }
  return { kind: isDc ? 'dc' : 'html', mime: null, text: out, w, h, warnings };
}

export type ImportInput = { bytes: Uint8Array; title?: string; note?: string; group?: string; device?: string; w?: number; h?: number; filename?: string };

export async function importMockup(user: User, input: ImportInput): Promise<{ mockup: Prototype; warnings: string[] }> {
  const info = inspect(input.bytes);
  const phone = (input.device ?? ((info.w ?? 0) > 0 && (info.w ?? 0) <= 500 ? 'phone' : 'desktop')) === 'phone';
  const fallbackTitle = (input.filename ?? '').replace(/\.[^.]+$/, '').replace(/\.dc$/i, '').replace(/[_-]+/g, ' ').trim();
  const c = clean({ title: input.title || fallbackTitle, note: input.note, group: input.group, device: phone ? 'phone' : 'desktop', w: input.w ?? info.w, h: input.h ?? info.h });
  const id = newId('m').replace(/[^A-Za-z0-9_]/g, '').slice(0, 14);
  await fs.mkdir(MOCKUP_DIR, { recursive: true });
  if (info.kind === 'image') await fs.writeFile(path.join(MOCKUP_DIR, `u-${id}.raw`), input.bytes, { flag: 'wx' });
  else await fs.writeFile(path.join(MOCKUP_DIR, `u-${id}.html`), info.text!, { flag: 'wx' });
  getDb()
    .prepare('INSERT INTO mockups (id, title, note, group_name, kind, mime, device, w, h, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, c.title, c.note, c.group, info.kind, info.mime, c.device, c.w, c.h, user.id, new Date().toISOString());
  return { mockup: getMockup(id)!, warnings: info.warnings };
}

export function updateMockup(id: string, patch: Record<string, unknown>): Prototype {
  const row = getDb().prepare('SELECT * FROM mockups WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new Problem(404, 'Only imported mockups can be edited.');
  const c = clean({ title: patch.title, note: patch.note, group: patch.group, device: patch.device, w: patch.w, h: patch.h }, row);
  getDb().prepare('UPDATE mockups SET title = ?, note = ?, group_name = ?, device = ?, w = ?, h = ? WHERE id = ?').run(c.title, c.note, c.group, c.device, c.w, c.h, id);
  return getMockup(id)!;
}

/**
 * Imported mockups are deleted for good, with their comments, drawings and attached images.
 * Built-in ones are only hidden (comments are kept) and can be brought back.
 */
export async function deleteMockup(id: string): Promise<{ removedComments: number; hidden: boolean }> {
  const db = getDb();
  const row = db.prepare('SELECT id, kind FROM mockups WHERE id = ?').get(id) as { id: string; kind: string } | undefined;
  if (!row) {
    if (!BUILTIN.some((p) => p.id === id)) throw new Problem(404, 'Not found.');
    db.prepare('INSERT OR IGNORE INTO mockups_hidden (id, hidden_at) VALUES (?, ?)').run(id, new Date().toISOString());
    return { removedComments: 0, hidden: true };
  }
  const files = db
    .prepare("SELECT a.id, a.mime FROM attachments a JOIN messages m ON m.id = a.message_id JOIN threads t ON t.id = m.thread_id WHERE t.target_type = 'mockup' AND t.target_id = ?")
    .all(id) as { id: string; mime: string }[];
  const removedComments = commentCount(id);
  db.exec('BEGIN');
  try {
    // Annotations, messages and reads go with the thread (ON DELETE CASCADE).
    db.prepare("DELETE FROM threads WHERE target_type = 'mockup' AND target_id = ?").run(id);
    db.prepare('DELETE FROM mockups WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  await removeUploads(files);
  await fs.rm(path.join(MOCKUP_DIR, `u-${id}.html`), { force: true });
  await fs.rm(path.join(MOCKUP_DIR, `u-${id}.raw`), { force: true });
  return { removedComments, hidden: false };
}

export function restoreBuiltins(): number {
  return Number(getDb().prepare('DELETE FROM mockups_hidden').run().changes);
}

const wrapper = (id: string, title: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&"]/g, '')}</title><style>html,body{margin:0;background:#fff}img{display:block;width:100%;height:auto}</style></head><body><img src="./u-${id}.raw" alt=""></body></html>`;

/** The bytes for a file name under /api/prototypes. Returns null if it is not an imported file. */
export async function readImported(name: string): Promise<{ data: Uint8Array; type: string } | null> {
  const m = name.match(/^u-(m_[A-Za-z0-9_]{1,14})\.(html|raw)$/);
  if (!m) return null;
  const row = getDb().prepare('SELECT * FROM mockups WHERE id = ?').get(m[1]) as Row | undefined;
  if (!row) return null;
  try {
    if (row.kind === 'image') {
      if (m[2] === 'html') return { data: new TextEncoder().encode(wrapper(row.id, row.title)), type: 'text/html; charset=utf-8' };
      return { data: new Uint8Array(await fs.readFile(path.join(MOCKUP_DIR, `u-${row.id}.raw`))), type: row.mime ?? 'application/octet-stream' };
    }
    if (m[2] === 'raw') return null;
    return { data: new Uint8Array(await fs.readFile(path.join(MOCKUP_DIR, `u-${row.id}.html`))), type: 'text/html; charset=utf-8' };
  } catch {
    return null;
  }
}

/** For the handoff: the files of every imported mockup, as they should appear in mockups/. */
export async function importedFiles(): Promise<{ name: string; data: Uint8Array }[]> {
  const out: { name: string; data: Uint8Array }[] = [];
  const rows = getDb().prepare('SELECT id, kind FROM mockups ORDER BY created_at').all() as { id: string; kind: string }[];
  for (const r of rows) {
    for (const n of r.kind === 'image' ? [`u-${r.id}.html`, `u-${r.id}.raw`] : [`u-${r.id}.html`]) {
      const f = await readImported(n);
      if (f) out.push({ name: n, data: f.data });
    }
  }
  return out;
}
