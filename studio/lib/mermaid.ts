// Mermaid flowchart import and export for the flow editor. Only structure travels: step titles, kinds and arrows.
// Fields, notes and comments are not part of Mermaid, so an import adds plain steps and an export is a picture of the structure.
import type { NodeKind } from './types';

export type MNode = { id: string; title: string; kind: NodeKind };
export type MEdge = { source: string; target: string; label?: string };
export type Parsed = { nodes: MNode[]; edges: MEdge[]; skipped: string[] };

// Each kind has its own shape so a round trip keeps the kinds.
const SHAPES: { kind: NodeKind; open: string; close: string }[] = [
  { kind: 'question', open: '{{', close: '}}' }, // hexagon
  { kind: 'backend', open: '[[', close: ']]' }, // subroutine
  { kind: 'data', open: '[(', close: ')]' }, // cylinder
  { kind: 'external', open: '((', close: '))' }, // circle
  { kind: 'profile', open: '([', close: '])' }, // stadium
  { kind: 'screen', open: '[', close: ']' }, // rectangle
  { kind: 'action', open: '(', close: ')' }, // rounded
  { kind: 'decision', open: '{', close: '}' } // diamond
];
const SHAPE_FOR = Object.fromEntries(SHAPES.map((s) => [s.kind, s])) as Record<NodeKind, (typeof SHAPES)[number]>;

const clean = (s: string) =>
  s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/#quot[;\u0001]/g, '"').replace(/#amp[;\u0001]/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ').trim() || ' ';

export function exportMermaid(nodes: { id: string; data: { title: string; kind: NodeKind; status?: string } }[], edges: { source: string; target: string; label?: unknown }[]): string {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const n of nodes) {
    let base = n.id.replace(/[^A-Za-z0-9_]/g, '_') || 'n';
    while (used.has(base)) base += '_';
    used.add(base);
    ids.set(n.id, base);
  }
  const L = ['flowchart LR'];
  for (const n of nodes) {
    const s = SHAPE_FOR[n.data.kind] ?? SHAPE_FOR.screen;
    L.push(`  ${ids.get(n.id)}${s.open}"${esc(n.data.title)}"${s.close}`);
  }
  for (const e of edges) {
    const a = ids.get(e.source), b = ids.get(e.target);
    if (!a || !b) continue;
    const label = typeof e.label === 'string' && e.label.trim() ? `|${e.label.replace(/[|\r\n]/g, ' ').trim()}|` : '';
    L.push(`  ${a} -->${label} ${b}`);
  }
  // Colours by status (ignored when importing).
  L.push('  classDef draft fill:#fbe6c8,stroke:#b7791f', '  classDef agreed fill:#dcf2e1,stroke:#2f8f4e', '  classDef open fill:#fbddd3,stroke:#c23b22');
  const group = (st: string) => nodes.filter((n) => (st === 'agreed' ? n.data.status === 'agreed' : st === 'open' ? n.data.status === 'question' || n.data.kind === 'question' : n.data.status !== 'agreed' && n.data.status !== 'question' && n.data.kind !== 'question')).map((n) => ids.get(n.id)).join(',');
  for (const st of ['draft', 'agreed', 'open']) { const g = group(st); if (g) L.push(`  class ${g} ${st}`); }
  return L.join('\n') + '\n';
}

// ---- Parsing ----
const OPENERS = ['[[', '[(', '((', '([', '{{', '[', '(', '{', '>'];
const CLOSER: Record<string, string> = { '[[': ']]', '[(': ')]', '((': '))', '([': '])', '{{': '}}', '[': ']', '(': ')', '{': '}', '>': ']' };
const KIND_FOR: Record<string, NodeKind> = { '[[': 'backend', '[(': 'data', '((': 'external', '([': 'profile', '{{': 'question', '[': 'screen', '(': 'action', '{': 'decision', '>': 'screen' };
const ID = /^[A-Za-z0-9_À-￿]+/;
const SKIP_LINE = /^(flowchart|graph|subgraph|end\b|direction|style|classDef|class\b|linkStyle|click|%%|accTitle|accDescr|title)/i;

type Ref = { id: string; title?: string; kind?: NodeKind };

function readNode(s: string, i: number): { ref: Ref; end: number } | null {
  const m = ID.exec(s.slice(i));
  if (!m) return null;
  const id = m[0];
  let p = i + id.length;
  const rest = s.slice(p);
  const open = OPENERS.find((o) => rest.startsWith(o));
  if (!open) return { ref: { id }, end: p };
  const close = CLOSER[open];
  p += open.length;
  let text: string;
  if (s[p] === '"') {
    const q = s.indexOf('"', p + 1);
    if (q < 0) return null;
    text = s.slice(p + 1, q);
    p = q + 1;
    if (!s.startsWith(close, p)) return null;
    p += close.length;
  } else {
    const e = s.indexOf(close, p);
    if (e < 0) return null;
    text = s.slice(p, e);
    p = e + close.length;
  }
  return { ref: { id, title: clean(text), kind: KIND_FOR[open] }, end: p };
}

const INLINE = /^\s*(?:--|==|-\.)\s+(.+?)\s+(?:-->|---|==>|===|-\.->|\.->)\s*/;
const PLAIN = /^\s*<?(?:-{2,}|={2,}|-\.+-)[>xo]?(?:\s*\|([^|]*)\|)?\s*/;

export function parseMermaid(src: string): Parsed {
  const nodes = new Map<string, MNode>();
  const edges: MEdge[] = [];
  const skipped: string[] = [];
  const seenEdge = new Set<string>();
  const touch = (r: Ref) => {
    const cur = nodes.get(r.id);
    if (!cur) nodes.set(r.id, { id: r.id, title: r.title || r.id, kind: r.kind ?? 'screen' });
    else if (r.title) { cur.title = r.title; if (r.kind) cur.kind = r.kind; }
  };

  // Entities such as #quot; contain a semicolon, which would otherwise split the statement.
  const statements = src.replace(/#(\w+);/g, '#$1\u0001').split(/\r?\n/).flatMap((l) => l.split(';')).map((l) => l.trim()).filter(Boolean);
  for (const st of statements) {
    if (SKIP_LINE.test(st)) continue;
    let i = 0;
    const group = (): Ref[] | null => {
      const refs: Ref[] = [];
      for (;;) {
        while (st[i] === ' ') i++;
        const n = readNode(st, i);
        if (!n) return refs.length ? refs : null;
        refs.push(n.ref);
        i = n.end;
        const amp = /^\s*&\s*/.exec(st.slice(i));
        if (!amp) return refs;
        i += amp[0].length;
      }
    };
    let prev = group();
    if (!prev) { skipped.push(st); continue; }
    // Only commit a statement if all of it could be read.
    const refs: Ref[] = [...prev];
    const found: { a: Ref; b: Ref; label?: string }[] = [];
    let ok = true;
    for (;;) {
      const rest = st.slice(i);
      if (!rest.trim()) break;
      let label: string | undefined;
      const inl = INLINE.exec(rest);
      if (inl) { label = clean(inl[1]); i += inl[0].length; }
      else {
        const pl = PLAIN.exec(rest);
        if (!pl) { ok = false; break; }
        label = pl[1] !== undefined ? clean(pl[1]) : undefined;
        i += pl[0].length;
      }
      const next = group();
      if (!next) { ok = false; break; }
      refs.push(...next);
      for (const a of prev) for (const b of next) found.push({ a, b, label });
      prev = next;
    }
    if (!ok) { skipped.push(st); continue; }
    refs.forEach(touch);
    for (const { a, b, label } of found) {
      const k = `${a.id}>${b.id}>${label ?? ''}`;
      if (a.id !== b.id && !seenEdge.has(k)) { seenEdge.add(k); edges.push({ source: a.id, target: b.id, ...(label ? { label } : {}) }); }
    }
  }
  return { nodes: [...nodes.values()].slice(0, 300), edges: edges.filter((e) => nodes.has(e.source) && nodes.has(e.target)), skipped };
}
