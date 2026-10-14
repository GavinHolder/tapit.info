import { getDb } from './db.js';
import { newId } from './password.js';
import type { User } from './auth';
import { PROTOTYPES } from './prototypes';

export type ThreadRow = {
  id: string;
  kind: 'question' | 'comment';
  target_type: 'project' | 'flow' | 'step' | 'mockup';
  target_id: string;
  title: string;
  question_id: string | null;
  sort: number;
  section: string | null;
  priority: number;
  status: 'open' | 'answered' | 'resolved';
  created_at: string;
  updated_at: string;
  message_count: number;
  last_body: string | null;
  last_role: string | null;
  unread: number;
};

export type Attachment = { id: string; filename: string; mime: string; size: number };
export type MessageOut = { id: string; body: string; created_at: string; author: { id: string | null; name: string; role: 'owner' | 'client' | 'system' }; attachments: Attachment[] };

const TARGET_TYPES = ['project', 'flow', 'step', 'mockup'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export class Problem extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function validTarget(type: string, id: string): boolean {
  if (!TARGET_TYPES.includes(type as TargetType)) return false;
  if (type === 'project') return id === '';
  if (type === 'step') return /^[a-z0-9][a-z0-9-]{0,80}:[A-Za-z0-9_-]{1,40}$/.test(id);
  if (type === 'flow') return /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);
  return /^[A-Za-z0-9_-]{1,40}$/.test(id);
}

export function listThreads(user: User, f: { kind?: string; status?: string; targetType?: string; targetId?: string; q?: string }): ThreadRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [user.id, user.id];
  if (f.kind) { where.push('t.kind = ?'); args.push(f.kind); }
  if (f.status) { where.push('t.status = ?'); args.push(f.status); }
  if (f.targetType) { where.push('t.target_type = ?'); args.push(f.targetType); }
  if (f.targetId !== undefined && f.targetType) { where.push('t.target_id = ?'); args.push(f.targetId); }
  if (f.q) { where.push('t.title LIKE ?'); args.push(`%${f.q.replace(/[%_]/g, '')}%`); }
  const sql = `
    SELECT t.id, t.kind, t.target_type, t.target_id, t.title, t.question_id, t.sort, t.section, t.priority, t.status, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id) AS message_count,
      (SELECT m.body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_body,
      (SELECT COALESCE(u.role, 'system') FROM messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_role,
      EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.author_id IS NOT NULL AND m.author_id != ?
              AND m.created_at > COALESCE((SELECT r.last_read_at FROM thread_reads r WHERE r.thread_id = t.id AND r.user_id = ?), '')) AS unread
    FROM threads t
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE WHEN t.kind = 'question' THEN 0 ELSE 1 END, t.sort, t.updated_at DESC`;
  return getDb().prepare(sql).all(...args) as unknown as ThreadRow[];
}

export function getThread(user: User, id: string) {
  const db = getDb();
  const t = db.prepare('SELECT id, kind, target_type, target_id, title, question_id, section, priority, status, context_json, created_at, updated_at FROM threads WHERE id = ?').get(id) as
    | (Omit<ThreadRow, 'sort' | 'message_count' | 'last_body' | 'last_role' | 'unread'> & { context_json: string | null })
    | undefined;
  if (!t) throw new Problem(404, 'Not found.');
  const rows = db
    .prepare(
      `SELECT m.id, m.body, m.created_at, m.author_id, u.name, u.role
       FROM messages m LEFT JOIN users u ON u.id = m.author_id
       WHERE m.thread_id = ? ORDER BY m.created_at, m.rowid`
    )
    .all(id) as { id: string; body: string; created_at: string; author_id: string | null; name: string | null; role: 'owner' | 'client' | null }[];
  const atts = db.prepare('SELECT a.id, a.message_id, a.filename, a.mime, a.size FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.thread_id = ?').all(id) as (Attachment & { message_id: string })[];
  const messages: MessageOut[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    author: { id: r.author_id, name: r.name ?? 'TapIt Studio', role: r.role ?? 'system' },
    attachments: atts.filter((a) => a.message_id === r.id).map(({ id: aid, filename, mime, size }) => ({ id: aid, filename, mime, size }))
  }));
  const ctx = t.context_json ? (JSON.parse(t.context_json) as { why?: string; related?: { flow: string; step: string; title?: string }[] }) : {};
  const { context_json: _ctx, ...thread } = t;
  void _ctx;
  void user;
  return { thread: { ...thread, why: ctx.why ?? '', related: ctx.related ?? [] }, messages };
}

export function createThread(user: User, input: { kind: string; targetType: string; targetId: string; title: string; body: string; attachmentIds?: string[] }) {
  const kind = input.kind === 'question' ? 'question' : 'comment';
  if (kind === 'question' && user.role !== 'owner') throw new Problem(403, 'Only the developer can ask questions.');
  if (!validTarget(input.targetType, input.targetId)) throw new Problem(400, 'That target is not valid.');
  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim();
  if (!title) throw new Problem(400, 'Add a short title.');
  if (!body || body.length > 5000) throw new Problem(400, 'Write a message (up to 5000 characters).');
  const db = getDb();
  const id = newId('thr');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO threads (id, kind, target_type, target_id, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`
  ).run(id, kind, input.targetType, input.targetId, title, user.id, now, now);
  insertMessage(user, id, body, input.attachmentIds ?? [], now);
  markRead(user, id);
  return id;
}

function insertMessage(user: User, threadId: string, body: string, attachmentIds: string[], now: string) {
  const db = getDb();
  const mid = newId('msg');
  db.prepare('INSERT INTO messages (id, thread_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(mid, threadId, user.id, body, now);
  if (attachmentIds.length > 4) throw new Problem(400, 'You can attach up to 4 images to one message.');
  for (const aid of attachmentIds) {
    const res = db.prepare('UPDATE attachments SET message_id = ? WHERE id = ? AND uploaded_by = ? AND message_id IS NULL').run(mid, aid, user.id);
    if (!res.changes) throw new Problem(400, 'An attachment could not be added. Upload it again.');
  }
  return mid;
}

export function addMessage(user: User, threadId: string, bodyIn: string, attachmentIds: string[] = []) {
  const db = getDb();
  const t = db.prepare('SELECT kind, status FROM threads WHERE id = ?').get(threadId) as { kind: 'question' | 'comment'; status: 'open' | 'answered' | 'resolved' } | undefined;
  if (!t) throw new Problem(404, 'Not found.');
  const body = bodyIn.trim();
  if (!body || body.length > 5000) throw new Problem(400, 'Write a message (up to 5000 characters).');
  const now = new Date().toISOString();
  const mid = insertMessage(user, threadId, body, attachmentIds, now);
  // Who is waiting on whom:
  //  - a client reply to a question marks it answered (the developer reviews it);
  //  - a developer follow-up puts it back to open (waiting on the client);
  //  - on a comment thread any new message reopens it.
  let status = t.status;
  if (t.kind === 'question') status = user.role === 'client' ? 'answered' : 'open';
  else status = 'open';
  db.prepare('UPDATE threads SET status = ?, updated_at = ? WHERE id = ?').run(status, now, threadId);
  markRead(user, threadId);
  return { id: mid, status };
}

export function setStatus(threadId: string, status: string) {
  if (!['open', 'answered', 'resolved'].includes(status)) throw new Problem(400, 'Unknown status.');
  const res = getDb().prepare('UPDATE threads SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), threadId);
  if (!res.changes) throw new Problem(404, 'Not found.');
}

export function markRead(user: User, threadId: string) {
  getDb()
    .prepare(
      `INSERT INTO thread_reads (thread_id, user_id, last_read_at) VALUES (?, ?, ?)
       ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`
    )
    .run(threadId, user.id, new Date().toISOString());
}

// Numbers for the badge in the top bar and the headline in the inbox.
export function summary(user: User) {
  const db = getDb();
  const one = (sql: string, ...args: (string | number)[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  const unread = one(
    `SELECT COUNT(*) AS n FROM threads t WHERE EXISTS (
       SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.author_id IS NOT NULL AND m.author_id != ?
       AND m.created_at > COALESCE((SELECT r.last_read_at FROM thread_reads r WHERE r.thread_id = t.id AND r.user_id = ?), ''))`,
    user.id,
    user.id
  );
  const questions = one("SELECT COUNT(*) AS n FROM threads WHERE kind = 'question'");
  const open = one("SELECT COUNT(*) AS n FROM threads WHERE kind = 'question' AND status = 'open'");
  const answered = one("SELECT COUNT(*) AS n FROM threads WHERE kind = 'question' AND status = 'answered'");
  const resolved = one("SELECT COUNT(*) AS n FROM threads WHERE kind = 'question' AND status = 'resolved'");
  const openFirst = one("SELECT COUNT(*) AS n FROM threads WHERE kind = 'question' AND priority = 1 AND status = 'open'");
  return { unread, questions, open, answered, resolved, openFirst };
}


// ---- Pins, drawings and boxes on a mockup. Each one is a comment thread with a position. ----
export type AnnotationData =
  | { x: number; y: number }
  | { x: number; y: number; w: number; h: number }
  | { points: [number, number][]; color: string };

export const ANNOTATION_COLORS = ['#d92d20', '#1d4ed8', '#047857', '#b45309'];
const unit = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 10000) / 10000)) : null);

function cleanAnnotation(kind: string, raw: unknown): AnnotationData {
  const d = (raw ?? {}) as Record<string, unknown>;
  if (kind === 'pin') {
    const x = unit(d.x), y = unit(d.y);
    if (x === null || y === null) throw new Problem(400, 'The pin position is not valid.');
    return { x, y };
  }
  if (kind === 'box') {
    const x = unit(d.x), y = unit(d.y), w = unit(d.w), h = unit(d.h);
    if (x === null || y === null || w === null || h === null || w < 0.005 || h < 0.005) throw new Problem(400, 'The box is not valid.');
    return { x, y, w, h };
  }
  if (kind === 'draw') {
    if (!Array.isArray(d.points) || d.points.length < 2 || d.points.length > 400) throw new Problem(400, 'The drawing is not valid.');
    const points = d.points.map((p) => {
      const a = Array.isArray(p) ? unit(p[0]) : null, b = Array.isArray(p) ? unit(p[1]) : null;
      if (a === null || b === null) throw new Problem(400, 'The drawing is not valid.');
      return [a, b] as [number, number];
    });
    const color = ANNOTATION_COLORS.includes(String(d.color)) ? String(d.color) : ANNOTATION_COLORS[0];
    return { points, color };
  }
  throw new Problem(400, 'Unknown annotation type.');
}

export function createAnnotation(user: User, input: { mockup: string; kind: string; data: unknown; element?: string; body: string; attachmentIds?: string[] }) {
  if (!PROTOTYPES.some((p) => p.id === input.mockup)) throw new Problem(400, 'Unknown mockup.');
  const data = cleanAnnotation(input.kind, input.data);
  const body = input.body.trim();
  const element = (input.element ?? '').trim().slice(0, 160) || null;
  const title = body.replace(/\s+/g, ' ').slice(0, 80) || 'Comment';
  const id = createThread(user, { kind: 'comment', targetType: 'mockup', targetId: input.mockup, title, body, attachmentIds: input.attachmentIds });
  getDb()
    .prepare('INSERT INTO annotations (thread_id, mockup, kind, data, element, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, input.mockup, input.kind, JSON.stringify(data), element, new Date().toISOString());
  return id;
}

export function listAnnotations(user: User, mockup: string) {
  const threads = listThreads(user, { targetType: 'mockup', targetId: mockup });
  const rows = getDb().prepare('SELECT thread_id, kind, data, element, created_at FROM annotations WHERE mockup = ? ORDER BY created_at, rowid').all(mockup) as { thread_id: string; kind: string; data: string; element: string | null; created_at: string }[];
  const byId = new Map(threads.map((t) => [t.id, t]));
  return rows
    .map((r, i) => {
      const t = byId.get(r.thread_id);
      return t ? { n: i + 1, id: r.thread_id, kind: r.kind, data: JSON.parse(r.data) as AnnotationData, element: r.element, title: t.title, status: t.status, unread: t.unread, message_count: t.message_count } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
