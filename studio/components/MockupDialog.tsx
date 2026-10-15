'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Prototype } from '@/lib/prototypes';

// Import a new mockup, or edit the details of an imported one (developer only).
export function MockupDialog({ existing, groups, onClose, onDone }: { existing?: Prototype; groups: string[]; onClose: () => void; onDone: (id: string, warnings: string[]) => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [group, setGroup] = useState(existing?.group ?? (groups[0] ?? 'Imported'));
  const [device, setDevice] = useState<'phone' | 'desktop'>(existing?.device ?? 'desktop');
  const [w, setW] = useState(String(existing?.w ?? 1280));
  const [h, setH] = useState(String(existing?.h ?? 800));
  const [touched, setTouched] = useState(!!existing);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // Fill in sensible defaults from the file itself.
  async function pick(f: File | null) {
    setFile(f);
    setError('');
    if (!f) return;
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/\.dc$/i, '').replace(/[_-]+/g, ' ').trim());
    if (touched) return;
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth, nh = img.naturalHeight;
        // Phone screenshots are often 2x or 3x; show them at a sensible design width.
        const phone = nw / nh < 0.7;
        const dw = phone ? 390 : nw > 1600 ? 1280 : nw;
        setDevice(phone ? 'phone' : 'desktop');
        setW(String(dw));
        setH(String(Math.round((nh * dw) / nw)));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      try {
        const head = (await f.slice(0, 400000).text());
        const m = head.match(/"\$preview"\s*:\s*\{[^}]*\}/)?.[0] ?? '';
        const pw = m.match(/"width"\s*:\s*(\d+)/)?.[1], ph = m.match(/"height"\s*:\s*(\d+)/)?.[1];
        if (pw && ph) { setW(pw); setH(ph); setDevice(Number(pw) <= 500 ? 'phone' : 'desktop'); }
      } catch { /* defaults stay */ }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (existing) {
        await api(`/api/mockups/${existing.id}`, { method: 'PATCH', json: { title, note, group, device, w: Number(w), h: Number(h) } });
        await onDone(existing.id, []);
      } else {
        if (!file) throw new Error('Choose a file to import.');
        const fd = new FormData();
        fd.set('file', file);
        fd.set('title', title);
        fd.set('note', note);
        fd.set('group', group);
        fd.set('device', device);
        fd.set('w', w);
        fd.set('h', h);
        const r = await api<{ mockup: Prototype; warnings: string[] }>('/api/mockups', { method: 'POST', body: fd });
        await onDone(r.mockup.id, r.warnings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal mdlg" role="dialog" aria-modal="true" aria-label={existing ? 'Edit mockup' : 'Import a mockup'} onSubmit={submit}>
        <div className="modal-h">
          <h2>{existing ? 'Edit mockup details' : 'Import a mockup'}</h2>
          <button type="button" className="btn small" onClick={onClose}>Close</button>
        </div>

        {!existing && (
          <>
            <div
              className={'dropzone' + (drag ? ' on' : '')}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files[0] ?? null); }}
              onClick={() => box.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') box.current?.click(); }}
            >
              {file ? <b>{file.name}</b> : <b>Drop a file here, or click to choose</b>}
              <span>An HTML mockup (including Claude Design .dc.html files) or a PNG, JPEG, GIF or WebP screenshot. Up to 5 MB for HTML and 10 MB for images.</span>
              <input ref={box} type="file" aria-label="Mockup file" accept=".html,.htm,image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
            </div>
            <p className="hint warnnote">Only import files you made or trust. An HTML mockup runs inside Studio. It is blocked from reaching the internet or anything outside this page, but it can still run scripts on the page.</p>
          </>
        )}

        <label className="lbl">Name<input className="in" value={title} maxLength={100} required onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="lbl">What is it? (optional)<input className="in" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="mrow">
          <label className="lbl">Group
            <input className="in" list="mockup-groups" value={group} maxLength={60} onChange={(e) => setGroup(e.target.value)} />
            <datalist id="mockup-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </label>
          <label className="lbl">Shown as
            <select className="in" value={device} onChange={(e) => { setDevice(e.target.value as 'phone' | 'desktop'); setTouched(true); }}>
              <option value="desktop">Desktop</option>
              <option value="phone">Phone</option>
            </select>
          </label>
          <label className="lbl">Width (px)<input className="in" type="number" min={200} max={4000} value={w} onChange={(e) => { setW(e.target.value); setTouched(true); }} /></label>
          <label className="lbl">Height (px)<input className="in" type="number" min={200} max={12000} value={h} onChange={(e) => { setH(e.target.value); setTouched(true); }} /></label>
        </div>
        <p className="hint">Width and height are the size the mockup was designed at. Comments are placed relative to this size, so changing it later moves existing pins.</p>
        <div className="form-error" role="alert">{error}</div>
        <div className="mactions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !title.trim() || (!existing && !file)}>{busy ? 'Saving…' : existing ? 'Save' : 'Import'}</button>
        </div>
      </form>
    </div>
  );
}
