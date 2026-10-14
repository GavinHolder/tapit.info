'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ThreadView, statusText } from './ThreadView';

type Row = {
  id: string;
  kind: 'question' | 'comment';
  target_type: string;
  target_id: string;
  title: string;
  section: string | null;
  priority: number;
  status: 'open' | 'answered' | 'resolved';
  updated_at: string;
  message_count: number;
  unread: number;
};

type Tab = { key: string; label: string; test: (r: Row) => boolean };

const tabsFor = (role: 'owner' | 'client'): Tab[] =>
  role === 'client'
    ? [
        { key: 'todo', label: 'To answer', test: (r) => r.kind === 'question' && r.status === 'open' },
        { key: 'done', label: 'Answered', test: (r) => r.kind === 'question' && r.status !== 'open' },
        { key: 'comments', label: 'Comments', test: (r) => r.kind === 'comment' },
        { key: 'all', label: 'All', test: () => true }
      ]
    : [
        { key: 'review', label: 'To review', test: (r) => r.status === 'answered' || (r.kind === 'comment' && r.status === 'open' && r.unread > 0) },
        { key: 'waiting', label: 'Waiting on client', test: (r) => r.kind === 'question' && r.status === 'open' },
        { key: 'comments', label: 'Comments', test: (r) => r.kind === 'comment' },
        { key: 'resolved', label: 'Resolved', test: (r) => r.status === 'resolved' },
        { key: 'all', label: 'All', test: () => true }
      ];

const targetLabel = (r: Row) => {
  if (r.target_type === 'step') return 'Flow step';
  if (r.target_type === 'mockup') return 'Mockup';
  if (r.target_type === 'flow') return 'Flow';
  return 'General';
};

export function Inbox({ role, initialId }: { role: 'owner' | 'client'; initialId?: string }) {
  const tabs = useMemo(() => tabsFor(role), [role]);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState(tabs[0].key);
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const r = await api<{ threads: Row[] }>('/api/threads');
    setRows(r.threads);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  // Opening a thread from a link: pick the tab that contains it.
  useEffect(() => {
    if (!initialId || !rows.length) return;
    const row = rows.find((r) => r.id === initialId);
    const t = row && tabs.find((x) => x.test(row));
    if (t) setTab(t.key);
  }, [initialId, rows.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const questions = rows.filter((r) => r.kind === 'question');
  const answered = questions.filter((r) => r.status !== 'open').length;
  const first = questions.filter((r) => r.priority === 1);
  const firstLeft = first.filter((r) => r.status === 'open').length;
  const resolved = questions.filter((r) => r.status === 'resolved').length;
  const unreadTotal = rows.filter((r) => r.unread).length;

  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const shown = rows.filter((r) => current.test(r) && (!q || r.title.toLowerCase().includes(q.toLowerCase())));
  const sections = shown.reduce<Record<string, Row[]>>((acc, r) => {
    const k = r.kind === 'question' ? r.section || 'Questions' : 'Comments and discussion';
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  const pick = (id: string) => {
    setSelected(id);
    setComposing(false);
    window.history.replaceState(null, '', `/inbox?t=${id}`);
  };

  return (
    <div className="ib">
      <aside className="ib-list">
        <div className="ib-top">
          <h1>{role === 'client' ? 'Questions and messages' : 'Inbox'}</h1>
          {questions.length > 0 && (
            <div className="prog" aria-label="Question progress">
              <div className="prog-bar"><span style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
              <p>
                {role === 'client'
                  ? <><b>{answered}</b> of {questions.length} answered{firstLeft > 0 ? <> · <b>{firstLeft}</b> of the {first.length} we need first still open</> : <> · everything we need first is answered</>}</>
                  : <><b>{resolved}</b> resolved · <b>{answered - resolved}</b> to review · <b>{questions.length - answered}</b> waiting on the client</>}
              </p>
            </div>
          )}
          <div className="tabs" role="tablist">
            {tabs.map((t) => {
              const n = rows.filter(t.test).length;
              return (
                <button key={t.key} type="button" role="tab" aria-selected={t.key === tab} className={'tabbtn' + (t.key === tab ? ' on' : '')} onClick={() => setTab(t.key)}>
                  {t.label}<span className="cnt">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="ib-tools">
            <input className="in" aria-label="Search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="btn primary small" onClick={() => { setComposing(true); setSelected(null); }}>New message</button>
          </div>
          {unreadTotal > 0 && <p className="hint">{unreadTotal} with new replies</p>}
        </div>

        <div className="ib-rows">
          {!loaded && <p className="hint pad">Loading…</p>}
          {loaded && shown.length === 0 && <p className="hint pad">Nothing here{q ? ' matches your search' : ' right now'}.</p>}
          {Object.entries(sections).map(([name, list]) => (
            <section key={name}>
              <h3 className="sec">{name}</h3>
              {list.map((r) => (
                <button key={r.id} type="button" className={'row' + (r.id === selected ? ' on' : '')} onClick={() => pick(r.id)}>
                  <span className="row-t">
                    {r.unread > 0 && <i className="udot" aria-label="New reply" />}
                    {r.title}
                  </span>
                  <span className="row-m">
                    <span className={'tag st-' + r.status}>{statusText(r.kind, r.status, role)}</span>
                    {r.priority === 1 && r.status === 'open' && <span className="tag first">Needed first</span>}
                    {r.kind === 'comment' && <span className="tag">{targetLabel(r)}</span>}
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </aside>

      <section className="ib-detail">
        {composing && <NewThread role={role} onDone={async (id) => { await refresh(); pick(id); }} onCancel={() => setComposing(false)} />}
        {!composing && selected && <ThreadView id={selected} role={role} onChanged={refresh} />}
        {!composing && !selected && (
          <div className="empty ib-empty">
            <h2>{role === 'client' ? 'Start with the questions marked “Needed first”' : 'Pick a thread'}</h2>
            <p>{role === 'client' ? 'Pick a question on the left and type your answer. You can paste a screenshot or a link. We will see it straight away.' : 'Client replies appear here. Open a thread to read it, reply, or mark it resolved.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function NewThread({ role, onDone, onCancel }: { role: 'owner' | 'client'; onDone: (id: string) => void | Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>('/api/threads', { json: { kind: ask ? 'question' : 'comment', targetType: 'project', targetId: '', title, body } });
      await onDone(r.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
      setBusy(false);
    }
  }

  return (
    <form className="newthread" onSubmit={submit}>
      <h2>New message</h2>
      <label className="lbl">Subject<input className="in" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></label>
      <label className="lbl">Message<textarea className="in" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required /></label>
      {role === 'owner' && <label className="chk"><input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)} />This is a question the client needs to answer</label>}
      <div className="form-error" role="alert">{error}</div>
      <div className="tv-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <span className="grow" />
        <button type="submit" className="btn primary" disabled={busy || !title.trim() || !body.trim()}>Send</button>
      </div>
    </form>
  );
}
