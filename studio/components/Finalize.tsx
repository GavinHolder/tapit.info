'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Pre = {
  questions: { total: number; unanswered: { id: string; id_label: string | null; title: string; first: boolean }[]; toReview: number; confirmed: number };
  comments: { open: number; resolved: number };
  mockupComments: number;
  decisions: { approved: number; pending: number };
  next: number;
  last: { version: number; created_at: string } | null;
};
type Handoff = { id: string; version: number; folder: string; note: string; created_at: string; stats: Record<string, number> };
type Data = { pre: Pre; flows: { flows: number; open: number; draft: number; agreed: number }; handoffs: Handoff[] };

const when = (iso: string) => new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Finalize() {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ version: number; folder: string } | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => setData(await api<Data>('/api/finalize')), []);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  if (!data) return <div className="plain">{error || 'Loading…'}</div>;
  const { pre, flows, handoffs } = data;
  const warnings = pre.questions.unanswered.length + pre.questions.toReview + pre.comments.open + flows.open + pre.decisions.pending;

  async function run() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ version: number; folder: string }>('/api/finalize', { json: { note, acknowledged: ack } });
      setDone(r);
      setNote('');
      setAck(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finalize.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(version: number, which: 'code' | 'design') {
    const r = await api<{ text: string }>(`/api/finalize/${version}/file?name=${which}`);
    try {
      await navigator.clipboard.writeText(r.text);
      setCopied(`v${version} ${which}`);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Copying was blocked by the browser. Download the zip instead.');
    }
  }

  return (
    <div className="plain fin">
      <h1>Finalize</h1>
      <p className="lead">Turns everything agreed so far (flows, answers, comments, mockup feedback and images) into a numbered handoff folder with a build prompt for Claude Code and a design brief for Claude Design. Nothing is deleted. After you finalize, work carries on as draft v{pre.next + 1}.</p>

      <section className="card">
        <h2>Draft v{pre.next}: where things stand</h2>
        <div className="stats">
          <div><b>{pre.questions.confirmed}</b><span>questions confirmed</span></div>
          <div className={pre.questions.toReview ? 'warn' : ''}><b>{pre.questions.toReview}</b><span>answered, to review</span></div>
          <div className={pre.questions.unanswered.length ? 'warn' : ''}><b>{pre.questions.unanswered.length}</b><span>unanswered</span></div>
          <div className={pre.comments.open ? 'warn' : ''}><b>{pre.comments.open}</b><span>open comments{pre.mockupComments ? ` (${pre.mockupComments} on mockups)` : ''}</span></div>
          <div className={pre.decisions.pending ? 'warn' : ''}><b>{pre.decisions.approved}</b><span>design decisions approved{pre.decisions.pending ? ` (${pre.decisions.pending} waiting)` : ''}</span></div>
          <div className={flows.open ? 'warn' : ''}><b>{flows.open}</b><span>open steps in flows</span></div>
          <div><b>{flows.agreed}</b><span>flow steps agreed</span></div>
        </div>

        {pre.questions.unanswered.length > 0 && (
          <details className="open-list">
            <summary>Questions still unanswered ({pre.questions.unanswered.length})</summary>
            <ul>
              {pre.questions.unanswered.map((q) => (
                <li key={q.id}><Link className="link" href={`/inbox?t=${q.id}`}>{q.id_label?.toUpperCase()}</Link> {q.first && <span className="tag first">Needed first</span>} {q.title}</li>
              ))}
            </ul>
          </details>
        )}

        {warnings > 0 ? (
          <div className="callout" role="note">
            <b>There are {warnings} open items.</b> The prompts will list them under “Not decided yet” so Claude Code asks you instead of guessing. You can hand off anyway.
            <label className="chk"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I understand, hand off with these open</label>
          </div>
        ) : (
          <p className="ok">Nothing is open. Ready to hand off.</p>
        )}

        <label className="lbl">Note for this version (optional)
          <textarea className="in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="For example: pilot is two sites, ignore memberships for now." />
        </label>
        <div className="form-error" role="alert">{error}</div>
        <div>
          <button type="button" className="btn primary" disabled={busy || (warnings > 0 && !ack)} onClick={run}>{busy ? 'Creating…' : `Finalize v${pre.next}`}</button>
        </div>
        {done && (
          <div className="linkbox" role="status">
            <b>Handoff v{done.version} created.</b>
            <code>{done.folder}</code>
            <span className="hint">The folder is in your repository. Commit it, then give Claude Code the prompt below. You can also download everything as one zip.</span>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Previous handoffs</h2>
        {handoffs.length === 0 && <p className="hint">None yet.</p>}
        {handoffs.map((h) => (
          <div key={h.id} className="handoff">
            <div>
              <b>Version {h.version}</b> <span className="hint">{when(h.created_at)} · <code>planning/handoffs/{h.folder}</code></span>
              {h.note && <p className="hint">{h.note}</p>}
              <p className="hint">{h.stats.questions} questions ({h.stats.confirmed} confirmed, {h.stats.unanswered} unanswered) · {h.stats.steps} flow steps · {h.stats.mockupComments} mockup comments</p>
            </div>
            <div className="hbtns">
              <button type="button" className="btn small" onClick={() => void copy(h.version, 'code')}>{copied === `v${h.version} code` ? 'Copied' : 'Copy Claude Code prompt'}</button>
              <button type="button" className="btn small" onClick={() => void copy(h.version, 'design')}>{copied === `v${h.version} design` ? 'Copied' : 'Copy Claude Design brief'}</button>
              <a className="btn small primary" href={`/api/finalize/${h.version}/zip`}>Download zip</a>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
