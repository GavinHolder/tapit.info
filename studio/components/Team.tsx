'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type U = { id: string; email: string; name: string; role: string; disabled: number; created_at: string };
type I = { id: string; email: string; name: string; role: string; expires_at: string; used_at: string | null };

export function Team({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [invites, setInvites] = useState<I[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [wa, setWa] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [u, i] = await Promise.all([api<{ users: U[] }>('/api/team/users'), api<{ invites: I[] }>('/api/team/invites')]);
    setUsers(u.users);
    setInvites(i.invites);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLink('');
    setWa('');
    try {
      const r = await api<{ path: string; whatsapp: string }>('/api/team/invites', { json: { name, email, role: 'client', phone: phone || undefined } });
      setWa(r.whatsapp);
      setPhone('');
      setLink(window.location.origin + r.path);
      setName('');
      setEmail('');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invite.');
    }
  }

  async function toggle(u: U) {
    await api(`/api/team/users/${u.id}`, { method: 'PATCH', json: { disabled: !u.disabled } });
    void load();
  }

  return (
    <div className="team">
      <section className="card">
        <h2>Invite a client</h2>
        <p className="hint">Creates a one-time link, valid for 7 days. Send it to them yourself. They choose their own password.</p>
        <form onSubmit={invite} className="inv-form">
          <label className="lbl">Name<input className="in" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="lbl">Email<input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="lbl">Mobile (optional, sends the link on WhatsApp)<input className="in" inputMode="tel" placeholder="082 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button type="submit" className="btn primary" disabled={!name || !email}>Create invite link</button>
        </form>
        <div className="form-error" role="alert">{error}</div>
        {wa === 'sent' && <p className="ok">The invite link was sent to them on WhatsApp.</p>}
        {wa === 'failed' && <p className="form-error">WhatsApp could not deliver it. Copy the link below and send it yourself.</p>}
        {link && (
          <div className="linkbox">
            <p className="hint">Copy this now. It is shown only once.</p>
            <code>{link}</code>
            <button type="button" className="btn small" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>People</h2>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role === 'owner' ? 'Developer' : 'Client'}</td>
                <td>{u.id === selfId ? <span className="hint">You</span> : <button type="button" className="btn small" onClick={() => toggle(u)}>{u.disabled ? 'Switch on' : 'Switch off'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Invites</h2>
        {invites.length === 0 && <p className="hint">No invites yet.</p>}
        <table className="tbl">
          <tbody>
            {invites.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.email}</td>
                <td>{i.used_at ? 'Accepted' : new Date(i.expires_at) < new Date() ? 'Expired' : 'Waiting'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
