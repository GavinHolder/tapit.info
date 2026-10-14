import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, getDb } from './db.js';
import { newId } from './password.js';
import { PLANNING_DIR, readFlows } from './planning';
import { buildSpec } from './spec.js';
import { UPLOAD_DIR } from './uploads';
import { PROTOTYPES } from './prototypes';
import { zip } from './zip';
import type { User } from './auth';
import type { Flow } from './types';

export const HANDOFF_DIR = path.join(PLANNING_DIR, 'handoffs');
void DATA_DIR;

type Msg = { author: string; role: string; at: string; body: string; att: { id: string; filename: string; mime: string }[] };
type Annotation = { kind: string; data: Record<string, unknown>; element: string | null };
type T = {
  id: string; kind: 'question' | 'comment'; target_type: string; target_id: string; title: string; question_id: string | null;
  section: string | null; priority: number; status: 'open' | 'answered' | 'resolved'; created_at: string; updated_at: string;
  why: string; messages: Msg[]; annotation: Annotation | null;
};

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

function loadThreads(): T[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, kind, target_type, target_id, title, question_id, section, priority, status, context_json, created_at, updated_at FROM threads ORDER BY CASE WHEN kind = \'question\' THEN 0 ELSE 1 END, sort, created_at').all() as (Omit<T, 'messages' | 'annotation' | 'why'> & { context_json: string | null })[];
  const msgs = db.prepare('SELECT m.id, m.thread_id, m.body, m.created_at, u.name, u.role FROM messages m LEFT JOIN users u ON u.id = m.author_id ORDER BY m.created_at, m.rowid').all() as { id: string; thread_id: string; body: string; created_at: string; name: string | null; role: string | null }[];
  const atts = db.prepare('SELECT id, message_id, filename, mime FROM attachments WHERE message_id IS NOT NULL').all() as { id: string; message_id: string; filename: string; mime: string }[];
  const anns = db.prepare('SELECT thread_id, kind, data, element FROM annotations').all() as { thread_id: string; kind: string; data: string; element: string | null }[];
  const byThread = new Map<string, Msg[]>();
  for (const m of msgs) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push({ author: m.name ?? 'TapIt Studio', role: m.role ?? 'system', at: m.created_at, body: m.body, att: atts.filter((a) => a.message_id === m.id) });
    byThread.set(m.thread_id, list);
  }
  const annBy = new Map(anns.map((a) => [a.thread_id, { kind: a.kind, data: JSON.parse(a.data) as Record<string, unknown>, element: a.element }]));
  return rows.map(({ context_json, ...r }) => ({
    ...r,
    why: context_json ? ((JSON.parse(context_json) as { why?: string }).why ?? '') : '',
    messages: byThread.get(r.id) ?? [],
    annotation: annBy.get(r.id) ?? null
  }));
}

const role = (r: string) => (r === 'owner' ? 'Developer' : r === 'client' ? 'Client' : 'System');
const day = (iso: string) => iso.slice(0, 16).replace('T', ' ');
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const quote = (s: string) => s.split('\n').map((l) => '> ' + l).join('\n');

function renderMessages(msgs: Msg[], skipSystem = false): string {
  return msgs
    .filter((m) => !(skipSystem && m.role === 'system'))
    .map((m) => {
      const imgs = m.att.map((a) => `\n![${a.filename}](uploads/${a.id}.${EXT[a.mime] ?? 'png'})`).join('');
      return `**${m.author}** (${role(m.role)}, ${day(m.at)}):\n${quote(m.body)}${imgs}`;
    })
    .join('\n\n');
}

const clientAnswer = (t: T) => t.messages.filter((m) => m.role === 'client').map((m) => m.body).join('\n\n');
const where = (t: T, flows: Flow[]) => {
  if (t.target_type === 'step') {
    const [fid, nid] = t.target_id.split(':');
    const f = flows.find((x) => x.id === fid);
    const n = f?.nodes.find((x) => x.id === nid);
    return f && n ? `Flow “${f.title}”, step “${n.data.title}”` : `Flow step ${t.target_id}`;
  }
  if (t.target_type === 'flow') return `Flow “${flows.find((f) => f.id === t.target_id)?.title ?? t.target_id}”`;
  if (t.target_type === 'mockup') return `Mockup “${PROTOTYPES.find((p) => p.id === t.target_id)?.title ?? t.target_id}”`;
  return 'General';
};

// ---- What still needs attention before a handoff ----
export function preflight() {
  const threads = loadThreads();
  const q = threads.filter((t) => t.kind === 'question');
  const comments = threads.filter((t) => t.kind === 'comment');
  const last = lastHandoff();
  return {
    questions: {
      total: q.length,
      unanswered: q.filter((t) => t.status === 'open').map((t) => ({ id: t.id, id_label: t.question_id, title: t.title, first: t.priority === 1 })),
      toReview: q.filter((t) => t.status === 'answered').length,
      confirmed: q.filter((t) => t.status === 'resolved').length
    },
    comments: { open: comments.filter((t) => t.status !== 'resolved').length, resolved: comments.filter((t) => t.status === 'resolved').length },
    mockupComments: comments.filter((t) => t.annotation && t.status !== 'resolved').length,
    next: (last?.version ?? 0) + 1,
    last
  };
}

export async function flowWarnings() {
  const flows = await readFlows();
  let open = 0, draft = 0, agreed = 0;
  for (const f of flows) for (const n of f.nodes) {
    if (n.data.status === 'question' || n.data.kind === 'question') open++;
    else if (n.data.status === 'agreed') agreed++;
    else draft++;
  }
  return { flows: flows.length, open, draft, agreed };
}

export type HandoffRow = { id: string; version: number; folder: string; note: string; created_at: string; created_by: string | null; stats: Record<string, number> };
export function listHandoffs(): HandoffRow[] {
  const rows = getDb().prepare('SELECT id, version, folder, note, stats_json, created_by, created_at FROM handoffs ORDER BY version DESC').all() as { id: string; version: number; folder: string; note: string; stats_json: string; created_by: string | null; created_at: string }[];
  return rows.map(({ stats_json, ...r }) => ({ ...r, stats: JSON.parse(stats_json) as Record<string, number> }));
}
const lastHandoff = () => listHandoffs()[0] ?? null;

// ---- The prompts ----
function codePrompt(a: { version: number; date: string; note: string; flows: Flow[]; threads: T[]; since: string | null; flowSummary: { open: number } }) {
  const { flows, threads } = a;
  const qs = threads.filter((t) => t.kind === 'question');
  const confirmed = qs.filter((t) => t.status === 'resolved');
  const toConfirm = qs.filter((t) => t.status === 'answered');
  const unanswered = qs.filter((t) => t.status === 'open');
  const L: string[] = [];
  L.push(`# Build TapIt (handoff v${a.version}, ${a.date})`, '');
  L.push('You are Claude Code. Build the TapIt platform from this handoff. It was prepared in TapIt Studio by the developer together with the client. Everything in this folder is the agreed starting point.', '');
  if (a.note) L.push(`Developer's note for this version: ${oneLine(a.note)}`, '');
  L.push('## Read these first, in this order', '');
  L.push('1. `CLAUDE.md` in the repository root: the business rules. They override anything below.');
  L.push('2. `SPEC.md`: the plain-English build spec generated from the flows.');
  L.push('3. `client-answers.md`: the client\'s answers to our questions, with their status.');
  L.push('4. `discussions.md` and `mockup-feedback.md`: change requests and decisions made in review.');
  L.push('5. `flows/*.flow.json`: the machine-readable flows (steps, fields captured, reads, writes, API).');
  L.push('6. `mockups.json` and the `mockups/` folder in the repository: the interactive UI mockups to match.');
  if (a.since) L.push(`7. \`changes-since-previous.md\`: what changed since the previous handoff (${a.since}).`);
  L.push('', '## Non-negotiable rules', '');
  L.push('- TapIt is a conduit. No guest or end-user money ever passes through TapIt. Businesses sell their own bookings, vouchers and memberships and handle their own payments, refunds and terms. TapIt only earns referral commission, subscriptions and feature upsells, all invoiced to businesses.');
  L.push('- POPIA applies. Scans are anonymous. Trips and location need explicit opt-in, are private by default, and can be exported or deleted.');
  L.push('- Stack: Next.js (React) with TypeScript, mobile-first. Postgres with PostGIS on a VPS. No Supabase. Docker, Portainer and GitHub Actions. Everything self-hosted: no third-party services at runtime.');
  L.push('- Do not guess. Anything listed under "Not decided yet" must be asked of the developer, or built behind a clearly marked stub or setting that is easy to change.', '');
  L.push('## What to build, in suggested order', '');
  L.push('0. Foundations: repository layout, Docker and Compose, GitHub Actions build, Postgres with PostGIS and migrations, accounts and roles, a health check. Nothing else depends on choices still open.');
  flows.forEach((f, i) => {
    const open = f.nodes.filter((n) => n.data.status === 'question' || n.data.kind === 'question').length;
    const agreed = f.nodes.filter((n) => n.data.status === 'agreed').length;
    L.push(`${i + 1}. ${f.title}: ${f.nodes.length} steps (${agreed} agreed, ${open} open questions). ${oneLine(f.description || '')}`);
  });
  L.push('', 'For each item: make a short plan first, build it in small steps with tests, keep the app runnable after every step, and update `SPEC.md` assumptions in the pull request description.', '');

  L.push('## Agreed with the client', '');
  if (!confirmed.length) L.push('Nothing confirmed yet.');
  confirmed.forEach((t) => L.push(`- **${t.question_id?.toUpperCase()} ${oneLine(t.title)}**\n  Answer: ${oneLine(clientAnswer(t)) || '(see thread)'}`));
  L.push('', '## Answered by the client, not yet confirmed by the developer', '', 'Treat these as the working answer, but flag them in your plan.', '');
  if (!toConfirm.length) L.push('None.');
  toConfirm.forEach((t) => L.push(`- **${t.question_id?.toUpperCase()} ${oneLine(t.title)}**\n  Answer: ${oneLine(clientAnswer(t)) || '(see thread)'}`));
  L.push('', '## Not decided yet', '', 'Do not assume answers to these. Ask the developer before building anything that depends on them.', '');
  if (!unanswered.length && !a.flowSummary.open) L.push('Nothing outstanding.');
  unanswered.forEach((t) => L.push(`- ${t.priority === 1 ? '**Needed first.** ' : ''}${t.question_id?.toUpperCase()} ${oneLine(t.title)}${t.why ? ` Why it matters: ${oneLine(t.why)}` : ''}`));
  for (const f of flows) for (const n of f.nodes) if (n.data.status === 'question' || n.data.kind === 'question') L.push(`- Flow “${f.title}”, step “${n.data.title}”: ${oneLine(n.data.notes || '')}`);

  L.push('', '## Definition of done', '');
  L.push('- Each flow step behaves as written in `SPEC.md`, including the fields captured and the data it reads and writes.');
  L.push('- Screens match the mockups at phone width (390px) first, then desktop. Open comments in `mockup-feedback.md` are addressed or answered.');
  L.push('- Personal information fields marked in the spec are protected, exportable and deletable.');
  L.push('- Tests pass in CI, the Docker image builds, and the app starts from a clean database with seed data.');
  return L.join('\n') + '\n';
}

function designPrompt(a: { version: number; date: string; flows: Flow[]; threads: T[] }) {
  const { flows, threads } = a;
  const L: string[] = [];
  L.push(`# Design brief for TapIt (handoff v${a.version}, ${a.date})`, '');
  L.push('Use this with Claude Design to produce or refine the TapIt screens. Mobile first at all times.', '');
  L.push('## The product', '');
  L.push('TapIt is a tap-and-go concierge for guesthouses, activity operators and restaurants in the Overstrand. A guest taps an NFC stand (or scans a QR code) and lands on a branded page: house information, things to do nearby, a passport of stamps, partner vouchers, and a 3D replay of a trip they recorded. No app download. The businesses manage their own page.', '');
  L.push('## Design principles', '');
  L.push('- Clean, calm and clickable. Real interactive prototypes, not static boards.');
  L.push('- Phone first (390px wide), then a desktop layout (1280px). Large touch targets (44px or more), clear hierarchy, plain language.');
  L.push('- Base direction so far: deep teal with a lime accent, rounded cards, generous spacing. The first-round concepts explore other colours and badge styles; see `mockups.json`.');
  L.push('- Rich where it counts (the trip replay on a 3D map of the mountain), quiet everywhere else.');
  L.push('- Accessible: sufficient contrast, real buttons and labels, visible focus. No invented statistics or filler text; use clear placeholders.');
  L.push('- Money rule: TapIt never takes guest payments. Voucher and membership screens link out to the business\'s own checkout or terms.', '');
  L.push('## Screens to design or refine', '');
  for (const f of flows) {
    const screens = f.nodes.filter((n) => n.data.kind === 'screen' || n.data.kind === 'profile');
    if (!screens.length) continue;
    L.push(`### ${f.title}`, '');
    for (const n of screens) {
      const d = n.data;
      L.push(`- **${d.title}** (${d.lane}${d.status === 'agreed' ? ', agreed' : d.status === 'question' ? ', open question' : ', draft'})${d.notes ? `: ${oneLine(d.notes)}` : ''}`);
      if (d.fields.length) L.push(`  - Shows or captures: ${d.fields.map((x) => x.name + (x.pii ? ' (personal)' : '')).join(', ')}`);
      if (d.mockup) L.push(`  - Existing mockup: ${d.mockup}`);
    }
    L.push('');
  }
  L.push('## Change requests from review', '');
  const onMockups = threads.filter((t) => t.target_type === 'mockup' && t.status !== 'resolved');
  if (!onMockups.length) L.push('No open comments on the mockups.');
  for (const m of PROTOTYPES) {
    const list = onMockups.filter((t) => t.target_id === m.id);
    if (!list.length) continue;
    L.push(`### ${m.title}`, '');
    list.forEach((t, i) => {
      const last = t.messages.filter((x) => x.role !== 'system');
      const text = last.map((x) => oneLine(x.body)).join(' / ');
      L.push(`${i + 1}. ${t.annotation?.element ? `On ${t.annotation.element}: ` : ''}${text}`);
    });
    L.push('');
  }
  L.push('See `mockup-feedback.md` for exact positions and the full conversations, including any screenshots.', '');
  L.push('## Deliverables', '');
  L.push('- Interactive prototypes for each screen above, phone and desktop, with real states: empty, loading, error and success.');
  L.push('- Keep file names stable (same as `mockups.json`) so the next handoff can reference them.');
  L.push('- A short list of any new decisions you made, so they can be added to the flows.');
  return L.join('\n') + '\n';
}

// ---- The documents ----
function answersDoc(threads: T[]) {
  const L = ['# Client answers', '', 'Status: **Confirmed** by the developer, **Answered** by the client but not yet confirmed, **Unanswered**.', ''];
  let section = '';
  for (const t of threads.filter((x) => x.kind === 'question')) {
    if (t.section !== section) { section = t.section ?? ''; L.push(`## ${section || 'Questions'}`, ''); }
    const st = t.status === 'resolved' ? 'Confirmed' : t.status === 'answered' ? 'Answered' : 'Unanswered';
    L.push(`### ${t.question_id?.toUpperCase()} ${oneLine(t.title)}`, '');
    L.push(`Status: **${st}**${t.priority === 1 ? ' · needed first' : ''}`, '');
    if (t.why) L.push(`Why we ask: ${oneLine(t.why)}`, '');
    const body = renderMessages(t.messages, true);
    L.push(body || '_No answer yet._', '');
  }
  return L.join('\n');
}

function discussionsDoc(threads: T[], flows: Flow[]) {
  const L = ['# Discussions', '', 'Comments and messages that are not on a mockup. Resolved threads are listed last.', ''];
  const list = threads.filter((t) => t.kind === 'comment' && t.target_type !== 'mockup');
  const render = (t: T) => `### ${t.title}\n\nOn: ${where(t, flows)} · ${t.status === 'resolved' ? 'resolved' : 'open'}\n\n${renderMessages(t.messages)}\n`;
  L.push('## Open', '');
  list.filter((t) => t.status !== 'resolved').forEach((t) => L.push(render(t)));
  if (!list.some((t) => t.status !== 'resolved')) L.push('None.', '');
  L.push('## Resolved', '');
  list.filter((t) => t.status === 'resolved').forEach((t) => L.push(render(t)));
  if (!list.some((t) => t.status === 'resolved')) L.push('None.', '');
  return L.join('\n');
}

function mockupDoc(threads: T[]) {
  const L = ['# Mockup feedback', '', 'Positions are fractions of the mockup (0 to 1, from the top left) at its design size, so they hold at any screen size.', ''];
  for (const m of PROTOTYPES) {
    const list = threads.filter((t) => t.target_type === 'mockup' && t.target_id === m.id);
    if (!list.length) continue;
    L.push(`## ${m.title} (\`${m.file}\`)`, '');
    list.forEach((t, i) => {
      const a = t.annotation;
      const pos = a ? (a.kind === 'pin' ? `pin at x ${a.data.x}, y ${a.data.y}` : a.kind === 'box' ? `box at x ${a.data.x}, y ${a.data.y}, ${a.data.w} wide, ${a.data.h} high` : 'freehand drawing') : 'no position';
      L.push(`### ${i + 1}. ${t.title}`, '', `${t.status === 'resolved' ? 'Resolved' : 'Open'} · ${pos}${a?.element ? ` · on ${a.element}` : ''}`, '', renderMessages(t.messages), '');
    });
  }
  if (L.length <= 4) L.push('No comments on mockups.');
  return L.join('\n');
}

function changesDoc(threads: T[], since: string, prev: number) {
  const L = [`# Changes since handoff v${prev}`, '', `Everything below was written after ${since}.`, ''];
  let n = 0;
  for (const t of threads) {
    const fresh = t.messages.filter((m) => m.role !== 'system' && m.at > since);
    if (!fresh.length) continue;
    n++;
    L.push(`## ${t.kind === 'question' ? (t.question_id?.toUpperCase() ?? '') + ' ' : ''}${oneLine(t.title)}`, '', renderMessages(fresh), '');
  }
  if (!n) L.push('No new messages.');
  return L.join('\n');
}

export async function finalize(user: User, input: { note: string; acknowledged: boolean }) {
  const db = getDb();
  const [pre, fw, flows] = [preflight(), await flowWarnings(), await readFlows()];
  const warnings = pre.questions.unanswered.length + pre.questions.toReview + pre.comments.open + fw.open;
  if (warnings > 0 && !input.acknowledged) throw Object.assign(new Error('There are open items. Tick the box to hand off anyway.'), { status: 409 });
  const threads = loadThreads();
  const version = pre.next;
  const date = new Date().toISOString().slice(0, 10);
  const folderName = `${date}-v${version}`;
  const dir = path.join(HANDOFF_DIR, folderName);
  await fs.mkdir(path.join(dir, 'flows'), { recursive: true });
  await fs.mkdir(path.join(dir, 'uploads'), { recursive: true });

  const note = input.note.trim().slice(0, 2000);
  const since = pre.last?.created_at ?? null;
  const spec = buildSpec(flows);
  const files: Record<string, string> = {
    'CLAUDE_CODE_PROMPT.md': codePrompt({ version, date, note, flows, threads, since: pre.last ? `v${pre.last.version}` : null, flowSummary: fw }),
    'CLAUDE_DESIGN_PROMPT.md': designPrompt({ version, date, flows, threads }),
    'SPEC.md': spec,
    'client-answers.md': answersDoc(threads),
    'discussions.md': discussionsDoc(threads, flows),
    'mockup-feedback.md': mockupDoc(threads),
    'mockups.json': JSON.stringify(PROTOTYPES.map(({ id, file, title, note: n, w, h, device, group }) => ({ id, file: `mockups/${file}`, title, note: n, width: w, height: h, device, group })), null, 2) + '\n'
  };
  if (pre.last && since) files['changes-since-previous.md'] = changesDoc(threads, since, pre.last.version);
  for (const f of flows) files[`flows/${f.id}.flow.json`] = JSON.stringify(f, null, 2) + '\n';

  const stats = {
    flows: flows.length, steps: flows.reduce((n, f) => n + f.nodes.length, 0), questions: pre.questions.total, confirmed: pre.questions.confirmed,
    unanswered: pre.questions.unanswered.length, toReview: pre.questions.toReview, openComments: pre.comments.open, openStepsInFlows: fw.open, mockupComments: threads.filter((t) => t.annotation).length
  };
  files['README.md'] = [
    `# TapIt handoff v${version}`, '', `Created ${new Date().toISOString()} by ${user.name}.`, note ? `\nNote: ${oneLine(note)}\n` : '',
    '## What is in this folder', '',
    '- `CLAUDE_CODE_PROMPT.md`: paste or point Claude Code at this to start the build.',
    '- `CLAUDE_DESIGN_PROMPT.md`: the brief for Claude Design.',
    '- `SPEC.md`, `flows/`: the agreed application flow.',
    '- `client-answers.md`, `discussions.md`, `mockup-feedback.md`: everything the client and developer discussed.',
    '- `mockups.json`: the list of mockups (sources are in `mockups/` in the repository).',
    '- `uploads/`: images attached to messages.', '',
    '## State at hand-off', '', ...Object.entries(stats).map(([k, v]) => `- ${k}: ${v}`), ''
  ].join('\n');
  files['manifest.json'] = JSON.stringify({ version, folder: folderName, createdAt: new Date().toISOString(), createdBy: user.email, note, stats }, null, 2) + '\n';

  for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(dir, name), content, 'utf8');
  // Images attached to messages.
  const atts = db.prepare('SELECT id, mime FROM attachments WHERE message_id IS NOT NULL').all() as { id: string; mime: string }[];
  for (const a of atts) {
    try { await fs.copyFile(path.join(UPLOAD_DIR, `${a.id}.${EXT[a.mime]}`), path.join(dir, 'uploads', `${a.id}.${EXT[a.mime]}`)); } catch { /* file missing: skip */ }
  }
  db.prepare('INSERT INTO handoffs (id, version, folder, note, stats_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newId('hof'), version, folderName, note, JSON.stringify(stats), user.id, new Date().toISOString());
  return { version, folder: `planning/handoffs/${folderName}`, stats };
}

export async function handoffZip(version: number): Promise<{ name: string; data: Uint8Array } | null> {
  const row = listHandoffs().find((h) => h.version === version);
  if (!row) return null;
  const dir = path.join(HANDOFF_DIR, row.folder);
  const out: { name: string; data: Uint8Array }[] = [];
  const walk = async (rel: string) => {
    for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(r);
      else out.push({ name: `tapit-handoff-v${version}/${r}`, data: new Uint8Array(await fs.readFile(path.join(dir, r))) });
    }
  };
  try { await walk(''); } catch { return null; }
  return { name: `tapit-handoff-v${version}.zip`, data: zip(out) };
}

export async function readHandoffFile(version: number, file: 'CLAUDE_CODE_PROMPT.md' | 'CLAUDE_DESIGN_PROMPT.md'): Promise<string | null> {
  const row = listHandoffs().find((h) => h.version === version);
  if (!row) return null;
  try { return await fs.readFile(path.join(HANDOFF_DIR, row.folder, file), 'utf8'); } catch { return null; }
}
