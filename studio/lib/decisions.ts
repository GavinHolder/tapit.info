import { getDb } from './db.js';
import { newId } from './password.js';
import type { User } from './auth';
import { isMockupId } from './mockups';
import { Problem, addMessage, listThreads } from './threads';

export type Option = { id: string; label: string; note?: string; mockup?: string };
export type Status = 'proposed' | 'approved' | 'changes' | 'superseded';
export type Decision = {
  id: string; area: string; title: string; description: string; options: Option[]; chosen: string | null; status: Status;
  thread_id: string; decided_by: string | null; decided_by_name: string | null; decided_at: string | null; unread: number; message_count: number; updated_at: string;
};

type Row = Omit<Decision, 'options' | 'decided_by_name' | 'unread' | 'message_count'> & { options_json: string };

export function listDecisions(user: User): Decision[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.id, d.area, d.title, d.description, d.options_json, d.chosen, d.status, d.thread_id, d.decided_by, d.decided_at, d.updated_at, u.name AS decided_by_name
       FROM decisions d LEFT JOIN users u ON u.id = d.decided_by ORDER BY d.sort, d.created_at`
    )
    .all() as (Row & { decided_by_name: string | null })[];
  const threads = new Map(listThreads(user, { targetType: 'project', targetId: '' }).map((t) => [t.id, t]));
  return rows.map(({ options_json, ...r }) => ({
    ...r,
    options: JSON.parse(options_json) as Option[],
    unread: threads.get(r.thread_id)?.unread ?? 0,
    message_count: threads.get(r.thread_id)?.message_count ?? 0
  }));
}

function cleanOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > 12) throw new Problem(400, 'Up to 12 options.');
  const seen = new Set<string>();
  return raw.map((o, i) => {
    const r = (o ?? {}) as Record<string, unknown>;
    const label = String(r.label ?? '').trim().slice(0, 120);
    if (!label) throw new Problem(400, 'Every option needs a name.');
    let id = String(r.id ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || `o${i + 1}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const mockup = typeof r.mockup === 'string' && isMockupId(r.mockup) ? r.mockup : undefined;
    const note = String(r.note ?? '').trim().slice(0, 300);
    return { id, label, ...(note ? { note } : {}), ...(mockup ? { mockup } : {}) };
  });
}

export function createDecision(user: User, input: { area: string; title: string; description: string; options: unknown }) {
  if (user.role !== 'owner') throw new Problem(403, 'Only the developer can propose decisions.');
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new Problem(400, 'Add a title.');
  const area = input.area.trim().slice(0, 40) || 'General';
  const description = input.description.trim().slice(0, 2000);
  const options = cleanOptions(input.options);
  const db = getDb();
  const now = new Date().toISOString();
  const tid = newId('thr');
  db.prepare(`INSERT INTO threads (id, kind, target_type, target_id, title, status, created_by, created_at, updated_at) VALUES (?, 'comment', 'project', '', ?, 'open', ?, ?, ?)`).run(tid, `Decision: ${title}`, user.id, now, now);
  db.prepare('INSERT INTO messages (id, thread_id, author_id, body, created_at) VALUES (?, ?, NULL, ?, ?)').run(newId('msg'), tid, `Decision: ${title}. ${description}`.trim(), now);
  const sort = ((db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM decisions').get() as { n: number }).n) + 1;
  const id = newId('dec');
  db.prepare('INSERT INTO decisions (id, area, title, description, options_json, thread_id, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, area, title, description, JSON.stringify(options), tid, sort, now, now);
  return id;
}

function get(id: string): Row {
  const r = getDb().prepare('SELECT id, area, title, description, options_json, chosen, status, thread_id, decided_by, decided_at, updated_at FROM decisions WHERE id = ?').get(id) as Row | undefined;
  if (!r) throw new Problem(404, 'Not found.');
  return r;
}

// Editing a decision that was approved or sent back puts it in front of the client again.
export function updateDecision(user: User, id: string, input: { area?: string; title?: string; description?: string; options?: unknown; status?: string }) {
  if (user.role !== 'owner') throw new Problem(403, 'Only the developer can edit decisions.');
  const cur = get(id);
  const db = getDb();
  const now = new Date().toISOString();
  if (input.status === 'superseded') {
    db.prepare("UPDATE decisions SET status = 'superseded', updated_at = ? WHERE id = ?").run(now, id);
    return;
  }
  if (input.status === 'proposed' && cur.status === 'superseded') {
    db.prepare("UPDATE decisions SET status = 'proposed', updated_at = ? WHERE id = ?").run(now, id);
    return;
  }
  const title = (input.title ?? cur.title).trim().slice(0, 120);
  if (!title) throw new Problem(400, 'Add a title.');
  const options = input.options === undefined ? (JSON.parse(cur.options_json) as Option[]) : cleanOptions(input.options);
  const description = (input.description ?? cur.description).trim().slice(0, 2000);
  const area = (input.area ?? cur.area).trim().slice(0, 40) || 'General';
  const changed = title !== cur.title || description !== cur.description || area !== cur.area || JSON.stringify(options) !== cur.options_json;
  const reset = changed && cur.status !== 'proposed';
  db.prepare(`UPDATE decisions SET area = ?, title = ?, description = ?, options_json = ?, status = ?, chosen = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`).run(
    area, title, description, JSON.stringify(options), reset ? 'proposed' : cur.status, reset ? null : cur.chosen, reset ? null : cur.decided_by, reset ? null : cur.decided_at, now, id
  );
  if (reset) addMessage(user, cur.thread_id, 'I updated this decision, so it needs your approval again.');
}

export function deleteDecision(user: User, id: string) {
  if (user.role !== 'owner') throw new Problem(403, 'Only the developer can delete decisions.');
  const cur = get(id);
  const db = getDb();
  db.prepare('DELETE FROM decisions WHERE id = ?').run(id);
  db.prepare('DELETE FROM threads WHERE id = ?').run(cur.thread_id);
}

// The client approves one option, or sends the decision back with a reason.
export function respond(user: User, id: string, input: { action: string; option?: string; message?: string }) {
  if (user.role !== 'client') throw new Problem(403, 'Only the client approves decisions.');
  const cur = get(id);
  if (cur.status === 'superseded') throw new Problem(409, 'This decision is no longer active.');
  const options = JSON.parse(cur.options_json) as Option[];
  const message = (input.message ?? '').trim();
  const db = getDb();
  const now = new Date().toISOString();
  if (input.action === 'approve') {
    let chosen: string | null = null;
    let text = 'Approved.';
    if (options.length) {
      const o = options.find((x) => x.id === input.option);
      if (!o) throw new Problem(400, 'Choose one of the options first.');
      chosen = o.id;
      text = `Approved: ${o.label}.`;
    }
    db.prepare("UPDATE decisions SET status = 'approved', chosen = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?").run(chosen, user.id, now, now, id);
    addMessage(user, cur.thread_id, message ? `${text} ${message}` : text);
    return;
  }
  if (input.action === 'changes') {
    if (!message) throw new Problem(400, 'Say what should change.');
    const o = options.find((x) => x.id === input.option);
    db.prepare("UPDATE decisions SET status = 'changes', chosen = ?, decided_by = NULL, decided_at = NULL, updated_at = ? WHERE id = ?").run(o ? o.id : null, now, id);
    addMessage(user, cur.thread_id, `Changes requested${o ? ` (leaning towards ${o.label})` : ''}: ${message}`);
    return;
  }
  throw new Problem(400, 'Unknown action.');
}

