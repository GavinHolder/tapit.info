'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Cfg = { source: 'saved' | 'environment' | 'none'; enabled: boolean; host: string; port: number; security: 'starttls' | 'ssl' | 'none'; user: string; hasPassword: boolean; fromName: string; fromAddress: string; publicUrl: string; delaySeconds: number };
type T = Record<string, string>;
type Result = { ok: boolean; text: string } | null;

export function Settings({ email: myEmail }: { email: string }) {
  return (
    <div className="plain settings">
      <h1>Settings</h1>
      <EmailConnection myEmail={myEmail} />
      <EmailWording myEmail={myEmail} />
    </div>
  );
}

function EmailConnection({ myEmail }: { myEmail: string }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [f, setF] = useState({ enabled: true, host: '', port: 587, security: 'starttls', user: '', password: '', clearPassword: false, fromName: 'TapIt Studio', fromAddress: '', publicUrl: '', delaySeconds: 120 });
  const [to, setTo] = useState(myEmail);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<Result>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const c = await api<Cfg>('/api/settings/email');
    setCfg(c);
    setF({ enabled: c.source === 'none' ? true : c.enabled, host: c.host, port: c.port, security: c.security, user: c.user, password: '', clearPassword: false, fromName: c.fromName, fromAddress: c.fromAddress, publicUrl: c.publicUrl || window.location.origin, delaySeconds: c.delaySeconds });
  }, []);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  const set = (patch: Partial<typeof f>) => { setF((x) => ({ ...x, ...patch })); setSaved(false); setTest(null); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/settings/email', { method: 'PUT', json: f });
      await load();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTest(null);
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; sentTo?: string; error?: string }>('/api/settings/email/test', { json: { to, config: f } });
      setTest(r.ok ? { ok: true, text: `Sent to ${r.sentTo}. Check that inbox (and spam).` } : { ok: false, text: r.error ?? 'It did not send.' });
    } catch (err) {
      setTest({ ok: false, text: err instanceof Error ? err.message : 'It did not send.' });
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return <section className="card"><h2>Email connection</h2><p className="hint">{error || 'Loading…'}</p></section>;

  return (
    <section className="card">
      <h2>Email connection</h2>
      <p className="hint">
        Studio sends its emails through your own mail server, using an address on your own domain.
        {cfg.source === 'environment' && ' Right now it is using settings from the server configuration. Saving here replaces them.'}
        {cfg.source === 'none' && ' Email is not set up yet.'}
      </p>
      <form onSubmit={save} className="mailform">
        <label className="lbl">Mail server<input className="in" value={f.host} onChange={(e) => set({ host: e.target.value })} placeholder="mail.yourdomain.co.za" autoComplete="off" /></label>
        <label className="lbl">Port<input className="in" type="number" min={1} max={65535} value={f.port} onChange={(e) => set({ port: Number(e.target.value) })} /></label>
        <label className="lbl">Security
          <select className="in" value={f.security} onChange={(e) => set({ security: e.target.value })}>
            <option value="starttls">STARTTLS (usually port 587)</option>
            <option value="ssl">SSL/TLS (usually port 465)</option>
            <option value="none">None (only for a trusted local relay)</option>
          </select>
        </label>
        <label className="lbl">Username<input className="in" value={f.user} onChange={(e) => set({ user: e.target.value })} autoComplete="off" placeholder="studio@yourdomain.co.za" /></label>
        <label className="lbl">Password
          <input className="in" type="password" value={f.password} onChange={(e) => set({ password: e.target.value, clearPassword: false })} autoComplete="new-password" placeholder={cfg.hasPassword && !f.clearPassword ? '•••••••• saved. Type to replace.' : ''} />
        </label>
        <label className="lbl">Send from (email address)<input className="in" type="email" value={f.fromAddress} onChange={(e) => set({ fromAddress: e.target.value })} placeholder="studio@yourdomain.co.za" /></label>
        {cfg.hasPassword && <label className="chk fullrow"><input type="checkbox" checked={f.clearPassword} onChange={(e) => set({ clearPassword: e.target.checked, password: '' })} />Remove the saved password</label>}
        <label className="chk fullrow"><input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} />Send email notifications</label>
        <details className="fullrow adv">
          <summary>More options</summary>
          <div className="advgrid">
            <label className="lbl">Sender name shown to the reader<input className="in" value={f.fromName} onChange={(e) => set({ fromName: e.target.value })} /></label>
            <label className="lbl">Studio address used in email links<input className="in" value={f.publicUrl} onChange={(e) => set({ publicUrl: e.target.value })} placeholder="https://studio.yourdomain.co.za" /></label>
            <label className="lbl">Wait before emailing (seconds)<input className="in" type="number" min={0} max={3600} value={f.delaySeconds} onChange={(e) => set({ delaySeconds: Number(e.target.value) })} /></label>
          </div>
          <p className="hint">The wait lets several replies become one email. The password is stored encrypted and is never shown again.</p>
        </details>
        <div className="fullrow tv-actions">
          <button type="submit" className="btn primary" disabled={busy}>Save</button>
          {saved && <span className="ok">Saved.</span>}
        </div>
      </form>
      <div className="testbox">
        <h3>Check it works</h3>
        <div className="tv-actions">
          <input className="in" type="email" aria-label="Send the test to" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn" disabled={busy || !f.host || !to} onClick={sendTest}>Send a test email</button>
        </div>
        <p className="hint">Uses the settings above exactly as typed, even if you have not saved them yet.</p>
        {test && <p className={test.ok ? 'ok' : 'form-error'} role="status">{test.text}</p>}
      </div>
      <div className="form-error" role="alert">{error}</div>
    </section>
  );
}

const FIELD_HELP = '{{name}} the person · {{count}} number of messages · {{title}} the conversation · {{inviter}} who invited them · {{brand}} the brand name · {{days}} link lifetime';

function EmailWording({ myEmail }: { myEmail: string }) {
  const [kind, setKind] = useState<'notify' | 'invite'>('notify');
  const [sample, setSample] = useState<'one' | 'many'>('many');
  const [t, setT] = useState<T | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [to, setTo] = useState(myEmail);
  const [msg, setMsg] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void api<{ templates: T }>('/api/settings/templates').then((r) => { setT(r.templates); }).catch(() => undefined);
  }, []);

  // Live preview of what is typed.
  useEffect(() => {
    if (!t) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void api<{ subject: string; html: string }>('/api/settings/templates/preview', { json: { kind, sample, templates: t } }).then(setPreview).catch(() => undefined);
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [t, kind, sample]);

  if (!t) return null;
  const set = (k: string, v: string) => { setT({ ...t, [k]: v }); setMsg(null); };
  const text = (k: string, label: string, rows = 1) => (
    <label className="lbl" key={k}>{label}
      {rows > 1 ? <textarea className="in" rows={rows} value={t[k] ?? ''} onChange={(e) => set(k, e.target.value)} /> : <input className="in" value={t[k] ?? ''} onChange={(e) => set(k, e.target.value)} />}
    </label>
  );
  const color = (k: string, label: string) => (
    <label className="lbl" key={k}>{label}
      <span className="colorrow"><input type="color" aria-label={label} value={/^#[0-9a-fA-F]{6}$/.test(t[k]) ? t[k] : '#000000'} onChange={(e) => set(k, e.target.value)} /><input className="in mono" value={t[k] ?? ''} onChange={(e) => set(k, e.target.value)} maxLength={7} /></span>
    </label>
  );

  async function save() {
    setBusy(true);
    try { await api('/api/settings/templates', { method: 'PUT', json: { templates: t } }); setMsg({ ok: true, text: 'Saved. New emails use this wording.' }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' }); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!window.confirm('Put every email wording and colour back to the original?')) return;
    const r = await api<{ templates: T }>('/api/settings/templates', { method: 'DELETE' });
    setT(r.templates);
    setMsg({ ok: true, text: 'Back to the original wording.' });
  }
  async function sendMe() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; sentTo?: string; error?: string }>('/api/settings/templates/test', { json: { kind, to, templates: t } });
      setMsg(r.ok ? { ok: true, text: `Sent to ${r.sentTo}.` } : { ok: false, text: r.error ?? 'It did not send.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'It did not send.' });
    } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <details className="wordingdetails">
        <summary><h2>Email wording and look <span className="hint">(optional)</span></h2></summary>
      <p className="hint">Change what the emails say and how they look. The preview updates as you type. Placeholders in double curly brackets are filled in per email.</p>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'notify'} className={'tabbtn' + (kind === 'notify' ? ' on' : '')} onClick={() => setKind('notify')}>New message notification</button>
        <button type="button" role="tab" aria-selected={kind === 'invite'} className={'tabbtn' + (kind === 'invite' ? ' on' : '')} onClick={() => setKind('invite')}>Invitation</button>
      </div>
      <div className="wording">
        <div className="wfields">
          {kind === 'notify' ? (
            <>
              {text('subjectOne', 'Subject when there is one message')}
              {text('subjectMany', 'Subject when there are several')}
              {text('greeting', 'Greeting')}
              {text('introOne', 'Opening line, one message')}
              {text('introMany', 'Opening line, several messages')}
              {text('button', 'Button text')}
              <label className="chk"><input type="checkbox" checked={t.showPreview !== '0'} onChange={(e) => set('showPreview', e.target.checked ? '1' : '0')} />Show a short preview of each message (turn off to keep message text out of email)</label>
              {text('footer', 'Footer', 3)}
            </>
          ) : (
            <>
              {text('subjectInvite', 'Subject')}
              {text('greeting', 'Greeting')}
              {text('introInvite', 'Message', 5)}
              {text('buttonInvite', 'Button text')}
            </>
          )}
          <div className="two">
            {text('brandName', 'Brand name')}
          </div>
          <div className="two">{color('brandColor', 'Header colour')}{color('accentColor', 'Button colour')}</div>
          <p className="hint">{FIELD_HELP}</p>
        </div>
        <div className="wpreview">
          {kind === 'notify' && (
            <div className="seg" role="group" aria-label="Preview as">
              <span className="hint">Preview as</span>
              <button type="button" className={'tabbtn' + (sample === 'one' ? ' on' : '')} aria-pressed={sample === 'one'} onClick={() => setSample('one')}>One message</button>
              <button type="button" className={'tabbtn' + (sample === 'many' ? ' on' : '')} aria-pressed={sample === 'many'} onClick={() => setSample('many')}>Several messages</button>
            </div>
          )}
          <div className="subjectline"><span>Subject</span><b>{preview?.subject ?? '…'}</b></div>
          <iframe title="Email preview" sandbox="" srcDoc={preview?.html ?? ''} className="emailframe" />
        </div>
      </div>
      <div className="tv-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={save}>Save wording</button>
        <button type="button" className="btn" disabled={busy} onClick={reset}>Back to original</button>
        <span className="grow" />
        <input className="in" type="email" aria-label="Send this email to" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 260 }} />
        <button type="button" className="btn" disabled={busy || !to} onClick={sendMe}>Send me this email</button>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'form-error'} role="status">{msg.text}</p>}
      </details>
    </section>
  );
}
