'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Linkify } from './Linkify';

type Att = { id: string; filename: string; mime: string; size: number };
type Msg = { id: string; body: string; created_at: string; author: { id: string | null; name: string; role: 'owner' | 'client' | 'system' }; attachments: Att[] };
type Thread = {
  id: string;
  kind: 'question' | 'comment';
  title: string;
  section: string | null;
  priority: number;
  status: 'open' | 'answered' | 'resolved';
  why: string;
  related: { flow: string; step: string; title?: string }[];
};

export function statusText(kind: 'question' | 'comment', status: string, role: 'owner' | 'client'): string {
  if (status === 'resolved') return 'Resolved';
  if (kind === 'comment') return 'Open';
  if (status === 'answered') return role === 'owner' ? 'Answered, to review' : 'Answered';
  return role === 'owner' ? 'Waiting for the client' : 'Waiting for your answer';
}

const when = (iso: string) => new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const roleLabel = (r: string) => (r === 'owner' ? 'Developer' : r === 'client' ? 'Client' : 'TapIt Studio');

export function ThreadView({ id, role, compact = false, onChanged }: { id: string; role: 'owner' | 'client'; compact?: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<{ thread: Thread; messages: Msg[] } | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Att[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const d = await api<{ thread: Thread; messages: Msg[] }>(`/api/threads/${id}`);
    setData(d);
    await api(`/api/threads/${id}/read`, { method: 'POST' }).catch(() => undefined);
    window.dispatchEvent(new Event('studio:inbox'));
    onChanged?.();
  }, [id, onChanged]);

  useEffect(() => {
    setData(null);
    setText('');
    setFiles([]);
    setError('');
    void load().catch((e: Error) => setError(e.message));
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [data?.messages.length]);

  async function upload(list: FileList | File[]) {
    setError('');
    for (const f of Array.from(list)) {
      if (files.length >= 4) { setError('You can attach up to 4 images to one message.'); break; }
      const fd = new FormData();
      fd.append('file', f);
      try {
        const a = await api<Att>('/api/uploads', { body: fd });
        setFiles((cur) => [...cur, a]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not attach that.');
      }
    }
  }

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/threads/${id}/messages`, { json: { body: text, attachmentIds: files.map((f) => f.id) } });
      setText('');
      setFiles([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    await api(`/api/threads/${id}`, { method: 'PATCH', json: { status } });
    await load();
  }

  if (!data) return <div className="tv-empty">{error || 'Loading…'}</div>;
  const { thread, messages } = data;
  const isQuestion = thread.kind === 'question';

  return (
    <div className={'tv' + (compact ? ' compact' : '')}>
      {!compact && (
        <div className="tv-head">
          <div className="tv-tags">
            {isQuestion && thread.section && <span className="tag">{thread.section}</span>}
            {isQuestion && thread.priority === 1 && <span className="tag first">Needed first</span>}
            <span className={'tag st-' + thread.status}>{statusText(thread.kind, thread.status, role)}</span>
          </div>
          {!isQuestion && <h2>{thread.title}</h2>}
          {isQuestion && thread.why && <p className="why"><b>Why we ask.</b> {thread.why}</p>}
          {thread.related.length > 0 && (
            <p className="related">
              Related flow step{thread.related.length > 1 ? 's' : ''}:{' '}
              {thread.related.map((r, i) => (
                <span key={r.flow + r.step}>{i > 0 && ', '}<Link className="link" href={`/flows?flow=${r.flow}&step=${r.step}`}>{r.title || r.step}</Link></span>
              ))}
            </p>
          )}
        </div>
      )}

      <div className="tv-msgs" aria-live="polite">
        {messages.map((m) => (
          <article key={m.id} className={'msg ' + m.author.role + (m.author.role === role ? ' mine' : '')}>
            <header><b>{m.author.role === 'system' ? 'Question' : m.author.name}</b><span>{m.author.role === 'system' ? '' : roleLabel(m.author.role) + ' · '}{when(m.created_at)}</span></header>
            <p className="body"><Linkify text={m.body} /></p>
            {m.attachments.length > 0 && (
              <div className="atts">
                {m.attachments.map((a) => (
                  <a key={a.id} href={`/api/uploads/${a.id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${a.id}`} alt={a.filename} />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="tv-composer">
        {files.length > 0 && (
          <div className="atts pending">
            {files.map((a) => (
              <span key={a.id} className="att-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/uploads/${a.id}`} alt={a.filename} />
                <button type="button" aria-label={`Remove ${a.filename}`} onClick={() => setFiles((c) => c.filter((x) => x.id !== a.id))}>×</button>
              </span>
            ))}
          </div>
        )}
        <textarea
          className="in"
          rows={compact ? 2 : 3}
          aria-label={isQuestion ? 'Your answer' : 'Your reply'}
          placeholder={isQuestion ? (role === 'client' ? 'Type your answer. You can paste a screenshot or a link.' : 'Reply or ask a follow-up') : 'Write a reply. You can paste a screenshot or a link.'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void send(); }}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
            if (imgs.length) { e.preventDefault(); void upload(imgs); }
          }}
        />
        <div className="tv-actions">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
          <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>Attach image</button>
          {role === 'owner' && thread.status !== 'resolved' && <button type="button" className="btn small" onClick={() => setStatus('resolved')}>Mark resolved</button>}
          {role === 'owner' && thread.status === 'resolved' && <button type="button" className="btn small" onClick={() => setStatus('open')}>Reopen</button>}
          <span className="grow" />
          <button type="button" className="btn primary small" disabled={!text.trim() || busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
        <div className="form-error" role="alert">{error}</div>
      </div>
    </div>
  );
}
