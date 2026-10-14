'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Prefs = { mailEnabled: boolean; notifyEmail: boolean; waEnabled: boolean; waInbound: boolean; notifyWhatsapp: boolean; phone: string; phoneVerified: boolean };

// "Notifications" dialog: where messages from the other side reach you (email, WhatsApp).
export function NotifyPanel({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<Prefs | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setP(await api<Prefs>('/api/me/prefs')), []);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function toggle(patch: Partial<{ notifyEmail: boolean; notifyWhatsapp: boolean }>) {
    setError('');
    try { setP(await api<Prefs>('/api/me/prefs', { method: 'PATCH', json: patch })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  }
  async function wa(body: Record<string, string>) {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ sentTo?: string }>('/api/me/whatsapp', { json: body });
      if (r.sentTo) setSentTo(r.sentTo);
      if (body.action !== 'start') { setSentTo(''); setCode(''); setPhone(''); }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal notify" role="dialog" aria-modal="true" aria-label="Notifications" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><h2>Notifications</h2><button type="button" className="btn small" onClick={onClose}>Close</button></div>
        {!p && <p className="hint">{error || 'Loading…'}</p>}
        {p && (
          <>
            <p className="hint">You always see messages in the Inbox. These are extra ways to hear about new ones. Several messages close together arrive as one.</p>

            <section className="nsec">
              <h3>Email</h3>
              {!p.mailEnabled ? <p className="hint">Email is not set up on this server.</p> : (
                <label className="chk"><input type="checkbox" checked={p.notifyEmail} onChange={(e) => void toggle({ notifyEmail: e.target.checked })} />Email me about new messages</label>
              )}
            </section>

            <section className="nsec">
              <h3>WhatsApp</h3>
              {!p.waEnabled && <p className="hint">WhatsApp is not set up on this server.</p>}
              {p.waEnabled && p.phoneVerified && (
                <>
                  <p>Linked number: <b>{p.phone}</b></p>
                  <label className="chk"><input type="checkbox" checked={p.notifyWhatsapp} onChange={(e) => void toggle({ notifyWhatsapp: e.target.checked })} />Message me on WhatsApp about new messages</label>
                  {p.waInbound && <p className="hint">You can reply straight from WhatsApp. Your reply goes into the conversation you were last told about. Send STOP to pause, START to resume.</p>}
                  <button type="button" className="btn small danger" disabled={busy} onClick={() => void wa({ action: 'remove' })}>Remove my number</button>
                </>
              )}
              {p.waEnabled && !p.phoneVerified && !sentTo && (
                <form onSubmit={(e) => { e.preventDefault(); void wa({ action: 'start', phone }); }} className="nform">
                  <label className="lbl">Your mobile number<input className="in" inputMode="tel" autoComplete="tel" placeholder="082 123 4567 or +27 82 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                  <button type="submit" className="btn primary small" disabled={busy || phone.trim().length < 8}>Send me a code</button>
                  <p className="hint">We send a 6-digit code to this number on WhatsApp. The number is only used to message you about this project, and you can remove it any time.</p>
                </form>
              )}
              {p.waEnabled && !p.phoneVerified && sentTo && (
                <form onSubmit={(e) => { e.preventDefault(); void wa({ action: 'verify', code }); }} className="nform">
                  <p>A code was sent to <b>{sentTo}</b>.</p>
                  <label className="lbl">6-digit code<input className="in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
                  <div className="tv-actions">
                    <button type="submit" className="btn primary small" disabled={busy || code.length !== 6}>Confirm</button>
                    <button type="button" className="btn small" onClick={() => setSentTo('')}>Use a different number</button>
                  </div>
                </form>
              )}
            </section>
            <div className="form-error" role="alert">{error}</div>
          </>
        )}
      </div>
    </div>
  );
}
