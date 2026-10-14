'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ThreadView } from './ThreadView';

type Row = { id: string; title: string; status: string; unread: number; message_count: number };

// Discussion on one flow step. Each topic is a thread, so replies reach the other person's inbox.
export function StepDiscussion({ flowId, nodeId, role }: { flowId: string; nodeId: string; role: 'owner' | 'client' }) {
  const target = `${flowId}:${nodeId}`;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ threads: Row[] }>(`/api/threads?target_type=step&target_id=${encodeURIComponent(target)}`);
    setRows(r.threads);
  }, [target]);

  useEffect(() => {
    setRows(null);
    setOpen(null);
    setTitle('');
    setBody('');
    setError('');
    void load().catch(() => setRows([]));
  }, [load]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>('/api/threads', { json: { kind: 'comment', targetType: 'step', targetId: target, title: title.trim() || body.trim().slice(0, 60), body } });
      setTitle('');
      setBody('');
      await load();
      setOpen(r.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="grp discuss">
      <legend>Discussion</legend>
      {rows === null && <p className="hint">Loading…</p>}
      {rows?.length === 0 && <p className="hint">No discussion on this step yet.</p>}
      {rows?.map((r) => (
        <div key={r.id} className="dthread">
          <button type="button" className="dhead" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
            <span>{r.unread > 0 && <i className="udot" aria-label="New reply" />}{r.title}</span>
            <span className={'tag st-' + r.status}>{r.status === 'resolved' ? 'Resolved' : `${r.message_count} message${r.message_count === 1 ? '' : 's'}`}</span>
          </button>
          {open === r.id && <ThreadView id={r.id} role={role} compact onChanged={() => void load()} />}
        </div>
      ))}
      <form className="dnew" onSubmit={start}>
        <textarea className="in" rows={3} aria-label="Start a discussion on this step" placeholder="Comment or question about this step. Links are fine." value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit" className="btn primary small" disabled={busy || !body.trim()}>Start discussion</button>
        <div className="form-error" role="alert">{error}</div>
      </form>
    </fieldset>
  );
}
