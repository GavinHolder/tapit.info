'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// "Password" dialog in the top bar: change your own password.
export function PasswordPanel({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== again) { setError('The two new passwords are not the same.'); return; }
    setBusy(true);
    try {
      await api('/api/me/password', { json: { current, next } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal notify" role="dialog" aria-modal="true" aria-label="Change password" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><h2>Change password</h2><button type="button" className="btn small" onClick={onClose}>Close</button></div>
        {done ? (
          <p className="ok">Your password was changed. Any other device you were signed in on is signed out.</p>
        ) : (
          <form onSubmit={submit} className="nform">
            <label className="lbl">Current password<input className="in" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
            <label className="lbl">New password (10 or more characters)<input className="in" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
            <label className="lbl">New password again<input className="in" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
            <div className="form-error" role="alert">{error}</div>
            <button type="submit" className="btn primary" disabled={busy || !current || next.length < 10 || !again}>Change password</button>
          </form>
        )}
      </div>
    </div>
  );
}
