'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KINDS, LANES, STATUSES, type Field, type NodeKind, type Status } from '@/lib/types';
import { PROTOTYPES } from '@/lib/prototypes';
import { useStudio } from './store';

export function Inspector() {
  const selected = useStudio((s) => s.selected);
  const node = useStudio((s) => (s.selected?.type === 'node' ? s.nodes.find((n) => n.id === s.selected!.id) : undefined));
  const edge = useStudio((s) => (s.selected?.type === 'edge' ? s.edges.find((e) => e.id === s.selected!.id) : undefined));
  const updateNode = useStudio((s) => s.updateNode);
  const updateEdgeLabel = useStudio((s) => s.updateEdgeLabel);
  const removeSelected = useStudio((s) => s.removeSelected);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    try { setAuthor(localStorage.getItem('studio-author') || ''); } catch { /* private mode */ }
  }, []);

  if (!selected) {
    return (
      <aside className="inspector">
        <div className="empty">
          <h2>Select a step</h2>
          <p>Click any box to edit it. Drag from the dot on its right edge to connect it to another step. Press Delete to remove the selected step or arrow.</p>
        </div>
      </aside>
    );
  }

  if (edge) {
    return (
      <aside className="inspector">
        <h2>Arrow</h2>
        <label className="lbl">Label (for decisions, such as yes or no)
          <input className="in" value={typeof edge.label === 'string' ? edge.label : ''} onChange={(e) => updateEdgeLabel(edge.id, e.target.value)} />
        </label>
        <button type="button" className="btn danger" onClick={removeSelected}>Delete arrow</button>
      </aside>
    );
  }

  if (!node) return <aside className="inspector" />;
  const d = node.data;
  const set = (patch: Partial<typeof d>) => updateNode(node.id, patch);
  const setField = (i: number, patch: Partial<Field>) => set({ fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const addComment = () => {
    const t = text.trim();
    if (!t) return;
    const name = author.trim() || 'Reviewer';
    try { localStorage.setItem('studio-author', name); } catch { /* ignore */ }
    set({ comments: [...d.comments, { id: Math.random().toString(36).slice(2, 9), author: name, at: new Date().toISOString(), text: t }] });
    setText('');
  };

  return (
    <aside className="inspector">
      <div className="insp-head">
        <h2>Step</h2>
        <button type="button" className="btn danger small" onClick={removeSelected}>Delete</button>
      </div>

      <label className="lbl">Title
        <input className="in" value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="row3">
        <label className="lbl">Type
          <select className="in" value={d.kind} onChange={(e) => set({ kind: e.target.value as NodeKind })}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="lbl">Lane
          <select className="in" value={d.lane} onChange={(e) => set({ lane: e.target.value })}>
            {LANES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="lbl">Status
          <select className="in" value={d.status} onChange={(e) => set({ status: e.target.value as Status })}>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>

      <label className="lbl">What happens here
        <textarea className="in" rows={4} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>

      <fieldset className="grp">
        <legend>Information captured</legend>
        {d.fields.length === 0 && <p className="hint">Nothing captured at this step.</p>}
        {d.fields.map((f, i) => (
          <div className="frow" key={i}>
            <input className="in" aria-label="Field name" placeholder="Field name" value={f.name} onChange={(e) => setField(i, { name: e.target.value })} />
            <select className="in" aria-label="Field type" value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>
              {['text', 'email', 'phone', 'number', 'boolean', 'timestamp', 'select', 'file', 'location'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="chk"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} />Required</label>
            <label className="chk"><input type="checkbox" checked={f.pii} onChange={(e) => setField(i, { pii: e.target.checked })} />Personal info</label>
            <button type="button" className="btn small" aria-label="Remove field" onClick={() => set({ fields: d.fields.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => set({ fields: [...d.fields, { name: '', type: 'text', required: true, pii: false }] })}>Add field</button>
      </fieldset>

      <fieldset className="grp">
        <legend>Backend</legend>
        <label className="lbl">Reads (tables or services)
          <input className="in" value={d.reads} onChange={(e) => set({ reads: e.target.value })} />
        </label>
        <label className="lbl">Writes
          <input className="in" value={d.writes} onChange={(e) => set({ writes: e.target.value })} />
        </label>
        <label className="lbl">API
          <input className="in" value={d.api} onChange={(e) => set({ api: e.target.value })} />
        </label>
      </fieldset>

      <label className="lbl">Mockup
        <select className="in" value={PROTOTYPES.some((p) => p.file === d.mockup) ? d.mockup : d.mockup ? '__other' : ''} onChange={(e) => set({ mockup: e.target.value === '__other' ? d.mockup : e.target.value })}>
          <option value="">None</option>
          {PROTOTYPES.map((p) => <option key={p.id} value={p.file}>{p.title}</option>)}
          {d.mockup && !PROTOTYPES.some((p) => p.file === d.mockup) && <option value="__other">{d.mockup}</option>}
        </select>
      </label>
      {PROTOTYPES.some((p) => p.file === d.mockup) && (
        <Link className="link" href={`/review?board=${PROTOTYPES.find((p) => p.file === d.mockup)!.id}`}>Open this mockup</Link>
      )}

      <fieldset className="grp">
        <legend>Comments</legend>
        {d.comments.length === 0 && <p className="hint">No comments yet.</p>}
        {d.comments.map((c) => (
          <div className="cmt" key={c.id}>
            <div className="cmt-h"><b>{c.author}</b><span>{new Date(c.at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span></div>
            <div>{c.text}</div>
          </div>
        ))}
        <input className="in" aria-label="Your name" placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <textarea className="in" rows={3} aria-label="Add a comment" placeholder="Add a comment, a link or a question" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn primary small" onClick={addComment} disabled={!text.trim()}>Add comment</button>
      </fieldset>
    </aside>
  );
}
