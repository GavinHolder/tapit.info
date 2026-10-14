'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { GROUPS, PROTOTYPES, type Prototype } from '@/lib/prototypes';
import { ThreadView } from './ThreadView';

type Pt = [number, number];
type Data = { x: number; y: number } | { x: number; y: number; w: number; h: number } | { points: Pt[]; color: string };
type Ann = { n: number; id: string; kind: 'pin' | 'draw' | 'box'; data: Data; element: string | null; title: string; status: 'open' | 'answered' | 'resolved'; unread: number; message_count: number; can_delete: boolean };
type Draft = { kind: 'pin' | 'draw' | 'box'; data: Data; element: string };
type Mode = 'browse' | 'pin' | 'draw' | 'box';

const COLORS = ['#d92d20', '#1d4ed8', '#047857', '#b45309'];
const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: 'browse', label: 'Use it', hint: 'Click and scroll the mockup as a guest would.' },
  { key: 'pin', label: 'Pin', hint: 'Click anything to leave a comment on it.' },
  { key: 'draw', label: 'Draw', hint: 'Draw a line or circle around what you mean, then write your comment.' },
  { key: 'box', label: 'Box', hint: 'Drag a box around an area, then write your comment.' }
];

// A short description of the element under the pointer, so a comment can say what it points at.
function describe(el: Element | null): string {
  if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') return '';
  const text = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const tag = el.tagName.toLowerCase();
  const what = tag === 'button' ? 'Button' : tag === 'a' ? 'Link' : tag === 'img' || tag === 'svg' ? 'Image' : tag === 'input' || tag === 'textarea' || tag === 'select' ? 'Field' : /^h[1-6]$/.test(tag) ? 'Heading' : 'Element';
  return text ? `${what}: “${text}”` : what;
}

export function ReviewViewer({ initial, thread, role }: { initial?: string; thread?: string; role: 'owner' | 'client' }) {
  const first = PROTOTYPES.find((p) => p.id === initial) ?? PROTOTYPES[0];
  const [id, setId] = useState(first.id);
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<Mode>('browse');
  const [color, setColor] = useState(COLORS[0]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string | null>(thread ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [links, setLinks] = useState<Record<string, { flow: string; flowTitle: string; step: string; title: string }[]>>({});
  useEffect(() => { void api<{ links: typeof links }>('/api/mockup-links').then((r) => setLinks(r.links)).catch(() => undefined); }, []);
  const proto: Prototype = PROTOTYPES.find((p) => p.id === id) ?? PROTOTYPES[0];
  const src = `/api/prototypes/${proto.file}`;

  const load = useCallback(async () => {
    const r = await api<{ annotations: Ann[] }>(`/api/annotations?mockup=${proto.id}`);
    setAnns(r.annotations);
  }, [proto.id]);

  useEffect(() => {
    setAnns([]);
    setDraft(null);
    setMode('browse');
    void load().catch(() => undefined);
    const t = setInterval(() => void load().catch(() => undefined), 20000);
    return () => clearInterval(t);
  }, [load]);

  // A link to a comment opens the mockup it belongs to.
  useEffect(() => {
    if (!thread) return;
    void api<{ thread: { target_type: string; target_id: string } }>(`/api/threads/${thread}`).then((r) => {
      if (r.thread.target_type === 'mockup' && PROTOTYPES.some((p) => p.id === r.thread.target_id)) setId(r.thread.target_id);
    }).catch(() => undefined);
  }, [thread]);

  async function remove(a: Ann) {
    if (!window.confirm(a.message_count > 1 ? 'Delete this comment and its replies?' : 'Delete this comment?')) return;
    try {
      await api(`/api/annotations/${a.id}`, { method: 'DELETE' });
      setSelected(null);
      await load();
      window.dispatchEvent(new Event('studio:inbox'));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  // Delete key removes the selected comment (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || (e.key !== 'Delete')) return;
      const a = anns.find((x) => x.id === selected);
      if (a?.can_delete) void remove(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visible = useMemo(() => anns.filter((a) => showResolved || a.status !== 'resolved' || a.id === selected), [anns, showResolved, selected]);
  const counts = { open: anns.filter((a) => a.status !== 'resolved').length, resolved: anns.filter((a) => a.status === 'resolved').length };
  const groups = (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => ({ key: g, ...GROUPS[g], items: PROTOTYPES.filter((p) => p.group === g) }));

  return (
    <div className="rv">
      <aside className="rv-list">
        {groups.map((g) => (
          <section key={g.key} className="rv-group">
            <h2>{g.title}</h2>
            <p className="hint">{g.note}</p>
            {g.items.map((p) => (
              <button key={p.id} type="button" className={'rv-item' + (p.id === id ? ' on' : '')} onClick={() => { setId(p.id); setSelected(null); }}>
                <b>{p.title}</b>
                <span>{p.note}</span>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <section className="rv-main">
        <div className="rv-bar">
          <h1>{proto.title}</h1>
          <div className="rv-modes" role="toolbar" aria-label="Review tools">
            {MODES.map((m) => (
              <button key={m.key} type="button" className={'modebtn' + (mode === m.key ? ' on' : '')} aria-pressed={mode === m.key} onClick={() => { setMode(m.key); setDraft(null); }}>{m.label}</button>
            ))}
            {(mode === 'draw' || mode === 'box') && (
              <span className="swatches" role="radiogroup" aria-label="Pen colour">
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Colour ${c}`} className={'sw' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </span>
            )}
          </div>
          <div className="sp">
            <button type="button" className="btn small" onClick={() => setNonce((n) => n + 1)}>Restart</button>
            <a className="btn small" href={src} target="_blank" rel="noreferrer">Open full screen</a>
          </div>
        </div>

        <div className="rv-body">
          <div className="rv-stage">
            <Stage key={id + nonce} proto={proto} src={src} mode={mode} color={color} anns={visible} selected={selected} onSelect={(a) => { setSelected(a); setDraft(null); }} onDraft={(d) => { setDraft(d); setSelected(null); }} draft={draft} onMode={(m) => { setMode(m); setDraft(null); }} onDelete={(a) => void remove(a)} />
          </div>

          <aside className="rv-panel" aria-label="Comments on this mockup">
            <div className="rv-panel-h">
              <h2>Comments</h2>
              <span className="hint">{counts.open} open{counts.resolved ? `, ${counts.resolved} resolved` : ''}</span>
              {counts.resolved > 0 && <label className="chk"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />Show resolved</label>}
            </div>
            <p className="hint">{MODES.find((m) => m.key === mode)!.hint}</p>
            {(links[proto.id]?.length ?? 0) > 0 && !draft && !selected && (
              <details className="used">
                <summary>Used by {links[proto.id].length} flow step{links[proto.id].length === 1 ? '' : 's'}</summary>
                <ul>
                  {links[proto.id].map((l) => (
                    <li key={l.flow + l.step}><Link className="link" href={`/flows?flow=${l.flow}&step=${l.step}`}>{l.title}</Link> <span className="hint">{l.flowTitle}</span></li>
                  ))}
                </ul>
              </details>
            )}

            {draft && <DraftForm key={JSON.stringify(draft.data)} draft={draft} mockup={proto.id} onCancel={() => setDraft(null)} onDone={async (newId) => { setDraft(null); await load(); setSelected(newId); }} color={color} />}

            {!draft && selected && (
              <div className="rv-thread">
                <div className="tv-actions">
                  <button type="button" className="btn small" onClick={() => setSelected(null)}>Back to list</button>
                  <span className="grow" />
                  {anns.find((x) => x.id === selected)?.can_delete && <button type="button" className="btn small danger" onClick={() => remove(anns.find((x) => x.id === selected)!)}>Delete</button>}
                </div>
                <ThreadView id={selected} role={role} compact onChanged={() => void load().catch(() => undefined)} />
              </div>
            )}

            {!draft && !selected && (
              <ul className="alist">
                {anns.length === 0 && <li className="hint">No comments on this mockup yet. Choose Pin, Draw or Box above, then click the mockup.</li>}
                {anns.filter((a) => showResolved || a.status !== 'resolved').map((a) => (
                  <li key={a.id} className="aline">
                    <button type="button" className="aitem" onClick={() => setSelected(a.id)}>
                      <span className={'pinno st-' + a.status}>{a.n}</span>
                      <span className="atext">
                        <b>{a.unread > 0 && <i className="udot" aria-label="New reply" />}{a.title}</b>
                        <span>{a.element ? a.element + ' · ' : ''}{a.message_count} message{a.message_count === 1 ? '' : 's'}</span>
                      </span>
                    </button>
                    {a.can_delete && <button type="button" className="btn small danger adel" aria-label={`Delete comment ${a.n}`} onClick={() => remove(a)}>Delete</button>}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function DraftForm({ draft, mockup, color, onCancel, onDone }: { draft: Draft; mockup: string; color: string; onCancel: () => void; onDone: (id: string) => void | Promise<void> }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  void color;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>('/api/annotations', { json: { mockup, kind: draft.kind, data: draft.data, element: draft.element, body } });
      await onDone(r.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
      setBusy(false);
    }
  }

  return (
    <form className="draftform" onSubmit={send}>
      <h3>New comment</h3>
      {draft.element && <p className="hint">On: {draft.element}</p>}
      <textarea className="in" rows={4} autoFocus aria-label="Your comment" placeholder="What should change, or what do you think? Links are fine." value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && body.trim()) void send(e); }} />
      <div className="form-error" role="alert">{error}</div>
      <div className="tv-actions">
        <button type="button" className="btn small" onClick={onCancel}>Cancel</button>
        <span className="grow" />
        <button type="submit" className="btn primary small" disabled={busy || !body.trim()}>Send</button>
      </div>
    </form>
  );
}

function Stage({ proto, src, mode, color, anns, selected, draft, onSelect, onDraft, onMode, onDelete }: {
  proto: Prototype; src: string; mode: Mode; color: string; anns: Ann[]; selected: string | null; draft: Draft | null;
  onSelect: (id: string) => void; onDraft: (d: Draft) => void; onMode: (m: Mode) => void; onDelete: (a: Ann) => void;
}) {
  const W = proto.w, H = proto.h;
  const frame = useRef<HTMLIFrameElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; w: number; h: number; label: string } | null>(null);
  const [live, setLive] = useState<{ kind: 'draw' | 'box'; pts: Pt[]; box?: { x: number; y: number; w: number; h: number } } | null>(null);
  const start = useRef<Pt | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Wide mockups are shrunk to fit the space. Comments are stored as fractions, so they stay put at any size.
  useEffect(() => {
    const el = holder.current?.parentElement;
    if (!el) return;
    // Round and ignore tiny changes, so a scrollbar appearing can never start a resize loop.
    const fit = () => { const v = Math.round(Math.min(1, Math.max(0.3, (el.clientWidth - 40) / W)) * 100) / 100; setScale((cur) => (Math.abs(cur - v) < 0.03 ? cur : v)); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  // Right-click menu: add a comment where you click, or open / delete an existing one.
  const [menu, setMenu] = useState<{ x: number; y: number; ann?: Ann } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showMenu = (x: number, y: number, ann?: Ann) => setMenu({ x, y, ann });

  // In "Use it" mode the mockup itself gets the click, so listen inside it (same site, so it can be read).
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    let doc: Document | null = null;
    const handler = (e: MouseEvent) => { e.preventDefault(); showMenu(e.clientX, e.clientY); };
    const attach = () => { try { doc?.removeEventListener('contextmenu', handler); doc = f.contentDocument; doc?.addEventListener('contextmenu', handler); } catch { /* not readable */ } };
    attach();
    f.addEventListener('load', attach);
    return () => { f.removeEventListener('load', attach); try { doc?.removeEventListener('contextmenu', handler); } catch { /* gone */ } };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    const doc = (() => { try { return frame.current?.contentDocument ?? null; } catch { return null; } })();
    doc?.addEventListener('click', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key); doc?.removeEventListener('click', close); };
  }, [menu]);

  const local = (e: React.PointerEvent): Pt => {
    const r = overlay.current!.getBoundingClientRect();
    return [Math.min(W, Math.max(0, (e.clientX - r.left) / scale)), Math.min(H, Math.max(0, (e.clientY - r.top) / scale))];
  };

  // The element under the pointer inside the mockup (the mockup is served from this same site, so it can be read).
  const elementAt = (x: number, y: number) => {
    try {
      const el = frame.current?.contentDocument?.elementFromPoint(x, y) ?? null;
      if (!el) return { label: '', rect: null as DOMRect | null };
      return { label: describe(el), rect: el.getBoundingClientRect() };
    } catch {
      return { label: '', rect: null };
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode === 'browse' || e.button !== 0) return;
    const p = local(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode === 'pin') {
      const { label } = elementAt(p[0], p[1]);
      onDraft({ kind: 'pin', data: { x: p[0] / W, y: p[1] / H }, element: label });
      setHover(null);
      return;
    }
    start.current = p;
    setLive(mode === 'draw' ? { kind: 'draw', pts: [p] } : { kind: 'box', pts: [], box: { x: p[0], y: p[1], w: 0, h: 0 } });
  };

  const onMove = (e: React.PointerEvent) => {
    const p = local(e);
    if (mode === 'pin' && !start.current) {
      const { label, rect } = elementAt(p[0], p[1]);
      setHover(rect && label ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height, label } : null);
      return;
    }
    if (!start.current) return;
    if (mode === 'draw') setLive((l) => (l && l.kind === 'draw' && Math.hypot(p[0] - l.pts[l.pts.length - 1][0], p[1] - l.pts[l.pts.length - 1][1]) >= 4 ? { ...l, pts: [...l.pts, p] } : l));
    else {
      const s = start.current;
      setLive({ kind: 'box', pts: [], box: { x: Math.min(s[0], p[0]), y: Math.min(s[1], p[1]), w: Math.abs(p[0] - s[0]), h: Math.abs(p[1] - s[1]) } });
    }
  };

  const onUp = () => {
    if (!start.current || !live) return;
    start.current = null;
    if (live.kind === 'draw' && live.pts.length >= 2) {
      let pts = live.pts;
      if (pts.length > 200) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 200) === 0 || i === pts.length - 1);
      const mid = pts[Math.floor(pts.length / 2)];
      onDraft({ kind: 'draw', data: { points: pts.map(([x, y]) => [x / W, y / H] as Pt), color }, element: elementAt(mid[0], mid[1]).label });
    } else if (live.kind === 'box' && live.box && live.box.w > 8 && live.box.h > 8) {
      const b = live.box;
      onDraft({ kind: 'box', data: { x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H }, element: elementAt(b.x + b.w / 2, b.y + b.h / 2).label });
    }
    setLive(null);
  };

  const anchor = (a: { kind: string; data: Data }): Pt => {
    const d = a.data as never as Record<string, unknown>;
    if (a.kind === 'draw') return (d.points as Pt[])[0].map((v, i) => v * (i ? H : W)) as Pt;
    return [(d.x as number) * W, (d.y as number) * H];
  };

  const path = (pts: Pt[], scale = true) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${scale ? x * W : x},${scale ? y * H : y}`).join(' ');
  const draftAnn = draft ? { kind: draft.kind, data: draft.data } : null;

  return (
    <div ref={holder} className="rv-scaler" style={{ width: W * scale, height: H * scale, margin: '0 auto', position: 'relative' }}>
    <div className={'rv-wrap ' + proto.device} style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <iframe ref={frame} className="rv-frame" src={src} title={proto.title} width={W} height={H} />
      <div
        ref={overlay}
        className={'rv-overlay mode-' + mode}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => { e.preventDefault(); const r = overlay.current!.getBoundingClientRect(); showMenu((e.clientX - r.left) / scale, (e.clientY - r.top) / scale); }}
        style={{ ['--inv' as string]: 1 / scale }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {anns.map((a) =>
            a.kind === 'draw' ? (
              <path key={a.id} d={path((a.data as { points: Pt[] }).points)} fill="none" stroke={(a.data as { color: string }).color} strokeWidth={a.id === selected ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" opacity={a.status === 'resolved' ? 0.35 : 1} style={{ pointerEvents: 'stroke' }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const [mx, my] = anchor(a); showMenu(mx, my, a); }} />
            ) : a.kind === 'box' ? (
              <rect key={a.id} x={(a.data as { x: number }).x * W} y={(a.data as { y: number }).y * H} width={(a.data as { w: number }).w * W} height={(a.data as { h: number }).h * H} rx={4} fill="rgba(217,45,32,.08)" stroke="#d92d20" strokeWidth={a.id === selected ? 4 : 2.5} strokeDasharray="6 4" opacity={a.status === 'resolved' ? 0.35 : 1} style={{ pointerEvents: 'stroke' }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const [mx, my] = anchor(a); showMenu(mx, my, a); }} />
            ) : null
          )}
          {draftAnn?.kind === 'draw' && <path d={path((draftAnn.data as { points: Pt[] }).points)} fill="none" stroke={(draftAnn.data as { color: string }).color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
          {draftAnn?.kind === 'box' && <rect x={(draftAnn.data as { x: number }).x * W} y={(draftAnn.data as { y: number }).y * H} width={(draftAnn.data as { w: number }).w * W} height={(draftAnn.data as { h: number }).h * H} fill="rgba(217,45,32,.08)" stroke="#d92d20" strokeWidth={3} strokeDasharray="6 4" />}
          {live?.kind === 'draw' && <path d={path(live.pts, false)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
          {live?.kind === 'box' && live.box && <rect x={live.box.x} y={live.box.y} width={live.box.w} height={live.box.h} fill="rgba(217,45,32,.08)" stroke={color} strokeWidth={3} strokeDasharray="6 4" />}
        </svg>
        {hover && mode === 'pin' && (
          <div className="hl" style={{ left: hover.x, top: hover.y, width: hover.w, height: hover.h }}>
            <span style={{ top: hover.y < 26 ? '100%' : undefined }}>{hover.label}</span>
          </div>
        )}
        {anns.map((a) => {
          const [x, y] = anchor(a);
          return (
            <button
              key={a.id}
              type="button"
              className={'pinmark st-' + a.status + (a.id === selected ? ' sel' : '') + (a.unread ? ' unread' : '')}
              style={{ left: x, top: y }}
              aria-label={`Comment ${a.n}: ${a.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(a.id)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); showMenu(x, y, a); }}
            >
              {a.n}
            </button>
          );
        })}
        {draftAnn && (() => {
          const [x, y] = anchor(draftAnn);
          return <span className="pinmark draft" style={{ left: x, top: y }}>+</span>;
        })()}
      </div>
    </div>
    {menu && (
      <div
        ref={menuRef}
        className="ctxmenu mock"
        role="menu"
        aria-label={menu.ann ? `Comment ${menu.ann.n} actions` : 'Add a comment'}
        style={{ left: Math.max(4, Math.min(menu.x * scale, W * scale - 236)), top: Math.max(4, Math.min(menu.y * scale, H * scale - (menu.ann ? 110 : 160))) }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!menu.ann && (
          <>
            <div className="cm-h">Add to this screen</div>
            <button type="button" role="menuitem" className="cm-item" onClick={() => { const { label } = elementAt(menu.x, menu.y); onDraft({ kind: 'pin', data: { x: menu.x / W, y: menu.y / H }, element: label }); setMenu(null); }}>Pin a comment here</button>
            <button type="button" role="menuitem" className="cm-item" onClick={() => { onMode('draw'); setMenu(null); }}>Draw on the screen…</button>
            <button type="button" role="menuitem" className="cm-item" onClick={() => { onMode('box'); setMenu(null); }}>Box an area…</button>
            {mode !== 'browse' && <><div className="cm-sep" /><button type="button" role="menuitem" className="cm-item" onClick={() => { onMode('browse'); setMenu(null); }}>Stop annotating (use the mockup)</button></>}
          </>
        )}
        {menu.ann && (
          <>
            <div className="cm-h">Comment {menu.ann.n}</div>
            <button type="button" role="menuitem" className="cm-item" onClick={() => { onSelect(menu.ann!.id); setMenu(null); }}>Open comment</button>
            {menu.ann.can_delete ? <button type="button" role="menuitem" className="cm-item danger" onClick={() => { onDelete(menu.ann!); setMenu(null); }}>Delete {menu.ann.kind === 'pin' ? 'pin' : menu.ann.kind === 'draw' ? 'drawing' : 'box'}</button> : <div className="cm-h">You can only delete your own</div>}
          </>
        )}
      </div>
    )}
    </div>
  );
}
