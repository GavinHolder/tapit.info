'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PROTOTYPES } from '@/lib/prototypes';
import { ThreadView } from './ThreadView';

type Option = { id: string; label: string; note?: string; mockup?: string };
type Decision = {
  id: string; area: string; title: string; description: string; options: Option[]; chosen: string | null;
  status: 'proposed' | 'approved' | 'changes' | 'superseded'; decided_by_name: string | null; decided_at: string | null; unread: number; message_count: number; thread_id: string;
};

const LABEL = { proposed: 'Needs approval', approved: 'Approved', changes: 'Changes requested', superseded: 'Replaced' } as const;
const ownerLabel = (s: Decision['status']) => (s === 'proposed' ? 'Waiting for the client' : LABEL[s]);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const toLines = (o: Option[]) => o.map((x) => [x.label, x.note ?? '', x.mockup ?? ''].join(' | ').replace(/( \| )+$/, '')).join('\n');
const fromLines = (t: string): Option[] =>
  t.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const [label, note, mockup] = l.split('|').map((x) => x.trim());
    return { id: `o${i + 1}`, label, ...(note ? { note } : {}), ...(mockup ? { mockup } : {}) };
  });

export function Decisions({ role }: { role: 'owner' | 'client' }) {
  const [list, setList] = useState<Decision[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Decision | 'new' | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ decisions: Decision[] }>('/api/decisions');
    setList(r.decisions);
    window.dispatchEvent(new Event('studio:inbox'));
  }, []);
  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
    const t = setInterval(() => void load().catch(() => undefined), 20000);
    return () => clearInterval(t);
  }, [load]);

  if (!list) return <div className="plain">{error || 'Loading…'}</div>;
  const owner = role === 'owner';
  const groups: { key: Decision['status']; title: string; hint: string }[] = owner
    ? [
        { key: 'changes', title: 'Changes requested', hint: 'The client sent these back. Update them and they go back for approval.' },
        { key: 'proposed', title: 'Waiting for the client', hint: '' },
        { key: 'approved', title: 'Approved', hint: 'These go into the handoff as agreed.' },
        { key: 'superseded', title: 'Replaced', hint: '' }
      ]
    : [
        { key: 'proposed', title: 'Needs your approval', hint: 'Look at the mockup for each choice, pick one and approve it, or ask for a change.' },
        { key: 'changes', title: 'Sent back for changes', hint: 'We will update these.' },
        { key: 'approved', title: 'Approved by you', hint: '' },
        { key: 'superseded', title: 'Replaced', hint: '' }
      ];
  const done = list.filter((d) => d.status === 'approved').length;
  const active = list.filter((d) => d.status !== 'superseded').length;

  return (
    <div className="plain dec">
      <div className="dec-head">
        <div>
          <h1>Design decisions</h1>
          <p className="lead">The look and layout choices for TapIt. Once approved, they are written into the handoff so the build follows them. <b>{done}</b> of {active} approved.</p>
        </div>
        {owner && <button type="button" className="btn primary" onClick={() => setEditing('new')}>Propose a decision</button>}
      </div>
      <div className="prog" aria-hidden="true"><div className="prog-bar"><span style={{ width: `${active ? (done / active) * 100 : 0}%` }} /></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}

      {editing && <EditForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={async () => { setEditing(null); await load(); }} />}

      {groups.map((g) => {
        const items = list.filter((d) => d.status === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} className="dgroup">
            <h2>{g.title} <span className="cnt">{items.length}</span></h2>
            {g.hint && <p className="hint">{g.hint}</p>}
            {items.map((d) => <Card key={d.id} d={d} role={role} onChanged={load} onEdit={() => setEditing(d)} setError={setError} />)}
          </section>
        );
      })}
    </div>
  );
}

function Card({ d, role, onChanged, onEdit, setError }: { d: Decision; role: 'owner' | 'client'; onChanged: () => Promise<void>; onEdit: () => void; setError: (s: string) => void }) {
  const [pick, setPick] = useState<string>(d.chosen ?? '');
  const [msg, setMsg] = useState('');
  const [asking, setAsking] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = role === 'owner';

  async function act(action: 'approve' | 'changes') {
    setBusy(true);
    setError('');
    try {
      await api(`/api/decisions/${d.id}/respond`, { json: { action, option: pick || undefined, message: msg } });
      setMsg('');
      setAsking(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  async function ownerAct(status: 'superseded' | 'proposed') {
    await api(`/api/decisions/${d.id}`, { method: 'PATCH', json: { status } });
    await onChanged();
  }
  async function remove() {
    if (!window.confirm(`Delete “${d.title}” and its discussion?`)) return;
    await api(`/api/decisions/${d.id}`, { method: 'DELETE' });
    await onChanged();
  }

  return (
    <article className={'dcard st-' + d.status}>
      <header>
        <span className="tag">{d.area}</span>
        <span className={'tag dst-' + d.status}>{owner ? ownerLabel(d.status) : LABEL[d.status]}</span>
        {d.unread > 0 && <i className="udot" aria-label="New reply" />}
      </header>
      <h3>{d.title}</h3>
      {d.description && <p className="ddesc">{d.description}</p>}

      {d.options.length > 0 && (
        <fieldset className="dopts" disabled={owner || d.status === 'superseded'}>
          <legend className="sr">Options for {d.title}</legend>
          {d.options.map((o) => {
            const proto = o.mockup ? PROTOTYPES.find((p) => p.id === o.mockup) : undefined;
            const chosen = d.chosen === o.id && d.status === 'approved';
            return (
              <label key={o.id} className={'dopt' + (pick === o.id ? ' on' : '') + (chosen ? ' chosen' : '')}>
                <input type="radio" name={d.id} checked={pick === o.id} onChange={() => setPick(o.id)} />
                <span className="otext">
                  <b>{o.label}</b>{chosen && <span className="tag dst-approved">{owner ? 'Chosen by the client' : 'Your choice'}</span>}
                  {o.note && <span>{o.note}</span>}
                </span>
                {proto && <Link className="link small" href={`/review?board=${proto.id}`}>View {proto.title.toLowerCase()}</Link>}
              </label>
            );
          })}
        </fieldset>
      )}

      {d.status === 'approved' && <p className="hint">Approved by {d.decided_by_name ?? 'the client'} on {when(d.decided_at)}.</p>}

      {!owner && d.status !== 'superseded' && (
        <div className="dact">
          {asking && <textarea className="in" rows={3} autoFocus aria-label="What should change?" placeholder="What should change? You can paste a link." value={msg} onChange={(e) => setMsg(e.target.value)} />}
          <div className="tv-actions">
            {d.status !== 'approved' && <button type="button" className="btn primary small" disabled={busy || (d.options.length > 0 && !pick)} onClick={() => act('approve')}>Approve{d.options.length > 0 && pick ? ' this choice' : ''}</button>}
            {d.status === 'approved' && <button type="button" className="btn small" disabled={busy || !pick || pick === d.chosen} onClick={() => act('approve')}>Change my choice</button>}
            {!asking ? <button type="button" className="btn small" onClick={() => setAsking(true)}>Ask for changes</button> : <button type="button" className="btn small" disabled={busy || !msg.trim()} onClick={() => act('changes')}>Send</button>}
            {asking && <button type="button" className="btn small" onClick={() => { setAsking(false); setMsg(''); }}>Cancel</button>}
            <span className="grow" />
            <button type="button" className="btn small" onClick={() => setChat((c) => !c)} aria-expanded={chat}>{chat ? 'Hide discussion' : `Discussion${d.message_count > 1 ? ` (${d.message_count - 1})` : ''}`}</button>
          </div>
        </div>
      )}
      {owner && (
        <div className="tv-actions">
          {d.status !== 'superseded' && <button type="button" className="btn small" onClick={onEdit}>Edit</button>}
          {d.status !== 'superseded' ? <button type="button" className="btn small" onClick={() => ownerAct('superseded')}>Mark replaced</button> : <button type="button" className="btn small" onClick={() => ownerAct('proposed')}>Bring back</button>}
          <button type="button" className="btn small danger" onClick={remove}>Delete</button>
          <span className="grow" />
          <button type="button" className="btn small" onClick={() => setChat((c) => !c)} aria-expanded={chat}>{chat ? 'Hide discussion' : `Discussion${d.message_count > 1 ? ` (${d.message_count - 1})` : ''}`}</button>
        </div>
      )}
      {chat && <ThreadView id={d.thread_id} role={role} compact onChanged={() => void onChanged()} />}
    </article>
  );
}

function EditForm({ initial, onCancel, onDone }: { initial: Decision | null; onCancel: () => void; onDone: () => void | Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [area, setArea] = useState(initial?.area ?? 'Look and feel');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [options, setOptions] = useState(initial ? toLines(initial.options) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { title, area, description, options: fromLines(options) };
      if (initial) await api(`/api/decisions/${initial.id}`, { method: 'PATCH', json: body });
      else await api('/api/decisions', { json: body });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <form className="card dedit" onSubmit={submit}>
      <h2>{initial ? 'Edit decision' : 'Propose a decision'}</h2>
      {initial && initial.status !== 'proposed' && <p className="hint">Saving changes sends this back to the client for approval.</p>}
      <div className="inv-form">
        <label className="lbl">Title<input className="in" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} /></label>
        <label className="lbl">Area<input className="in" value={area} onChange={(e) => setArea(e.target.value)} maxLength={40} /></label>
      </div>
      <label className="lbl">What is being decided<textarea className="in" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></label>
      <label className="lbl">Options, one per line: name | short note | mockup id (optional)
        <textarea className="in mono" rows={5} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={'Version 2 | Clean and calm | Landing\nVersion 1 | First concept | Main'} />
      </label>
      <p className="hint">Mockup ids: {PROTOTYPES.map((p) => p.id).join(', ')}.</p>
      <div className="form-error" role="alert">{error}</div>
      <div className="tv-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <span className="grow" />
        <button type="submit" className="btn primary" disabled={busy || !title.trim()}>Save</button>
      </div>
    </form>
  );
}
