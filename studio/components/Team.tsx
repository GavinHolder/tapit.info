'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type U = { id: string; email: string; name: string; role: 'owner' | 'client'; disabled: number; created_at: string };
type I = { id: string; email: string; name: string; role: string; expires_at: string; used_at: string | null };

// A readable random password (no look-alike characters).
function generate(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const roleLabel = (r: string) => (r === 'owner' ? 'Developer' : 'Client');

export function Team({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [invites, setInvites] = useState<I[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'client' | 'owner'>('client');
  const [how, setHow] = useState<'invite' | 'password'>('invite');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [link, setLink] = useState('');
  const [made, setMade] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetDone, setResetDone] = useState<{ name: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [u, i] = await Promise.all([api<{ users: U[] }>('/api/team/users'), api<{ invites: I[] }>('/api/team/invites')]);
    setUsers(u.users);
    setInvites(i.invites);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { setError('Copying was blocked. Select the text and copy it yourself.'); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLink('');
    setMade(null);
    setBusy(true);
    try {
      if (how === 'invite') {
        const r = await api<{ path: string }>('/api/team/invites', { json: { name, email, role } });
        setLink(window.location.origin + r.path);
      } else {
        await api('/api/team/users', { json: { name, email, role, password } });
        setMade({ email: email.trim().toLowerCase(), password });
      }
      setName('');
      setEmail('');
      setPassword('');
      setShow(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add them.');
    } finally {
      setBusy(false);
    }
  }

  async function patch(u: U, body: Record<string, unknown>) {
    setError('');
    try {
      await api(`/api/team/users/${u.id}`, { method: 'PATCH', json: body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function reset(u: U) {
    setError('');
    try {
      await api(`/api/team/users/${u.id}`, { method: 'PATCH', json: { password: resetPw } });
      setResetDone({ name: u.name, password: resetPw });
      setResetFor(null);
      setResetPw('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the password.');
    }
  }

  return (
    <div className="team">
      <section className="card">
        <h2>Add a person</h2>
        <p className="hint">Add a client or another developer. Either send them an invite link (they choose their own password) or set a password now and give it to them.</p>
        <form onSubmit={add} className="addform">
          <label className="lbl">Name<input className="in" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="lbl">Email<input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="lbl">Role
            <select className="in" value={role} onChange={(e) => setRole(e.target.value as 'client' | 'owner')}>
              <option value="client">Client</option>
              <option value="owner">Developer</option>
            </select>
          </label>
          <p className="hint rolehint">A client answers questions, comments and approves decisions. A developer has full access, including adding people and finalizing.</p>
          <fieldset className="how">
            <legend className="sr">How they get in</legend>
            <label className="chk"><input type="radio" name="how" checked={how === 'invite'} onChange={() => setHow('invite')} />Send an invite link (they choose their password)</label>
            <label className="chk"><input type="radio" name="how" checked={how === 'password'} onChange={() => setHow('password')} />Set a password now</label>
          </fieldset>
          {how === 'password' && (
            <div className="pwrow">
              <label className="lbl">Password (10 or more characters)
                <input className="in mono" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
              </label>
              <button type="button" className="btn small" onClick={() => { setPassword(generate()); setShow(true); }}>Generate one</button>
              <button type="button" className="btn small" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
            </div>
          )}
          <div><button type="submit" className="btn primary" disabled={busy || !name || !email || (how === 'password' && password.length < 10)}>{how === 'invite' ? 'Create invite link' : 'Create account'}</button></div>
        </form>
        <div className="form-error" role="alert">{error}</div>

        {link && (
          <div className="linkbox">
            <p className="hint">Send them this link (valid 7 days). It is shown only once.</p>
            <code>{link}</code>
            <button type="button" className="btn small" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          </div>
        )}
        {made && (
          <div className="linkbox">
            <p className="hint">Account created. Give them these details. The password is shown only now. They can change it with the Password button in the top bar.</p>
            <code>Email: {made.email}{'\n'}Password: {made.password}</code>
            <button type="button" className="btn small" onClick={() => copy(`Email: ${made.email}\nPassword: ${made.password}\nAddress: ${window.location.origin}`, 'cred')}>{copied === 'cred' ? 'Copied' : 'Copy login details'}</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>People</h2>
        {resetDone && (
          <div className="linkbox">
            <p className="hint">New password set for {resetDone.name}. They are signed out everywhere. It is shown only now.</p>
            <code>{resetDone.password}</code>
            <button type="button" className="btn small" onClick={() => copy(resetDone.password, 'reset')}>{copied === 'reset' ? 'Copied' : 'Copy password'}</button>
          </div>
        )}
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.disabled ? 'Switched off' : 'Active'}</td>
                  <td className="acts">
                    {u.id === selfId ? <span className="hint">You (use Password in the top bar)</span> : (
                      <>
                        <button type="button" className="btn small" onClick={() => patch(u, { disabled: !u.disabled })}>{u.disabled ? 'Switch on' : 'Switch off'}</button>
                        <button type="button" className="btn small" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setResetPw(''); setResetDone(null); }}>Set password</button>
                        <button type="button" className="btn small" onClick={() => { if (window.confirm(`Make ${u.name} a ${u.role === 'owner' ? 'client' : 'developer'}?`)) void patch(u, { role: u.role === 'owner' ? 'client' : 'owner' }); }}>Make {u.role === 'owner' ? 'client' : 'developer'}</button>
                        {resetFor === u.id && (
                          <div className="resetrow">
                            <input className="in mono" type="text" aria-label={`New password for ${u.name}`} placeholder="New password (10+ characters)" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                            <button type="button" className="btn small" onClick={() => setResetPw(generate())}>Generate</button>
                            <button type="button" className="btn primary small" disabled={resetPw.length < 10} onClick={() => reset(u)}>Save</button>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Invites</h2>
        {invites.length === 0 && <p className="hint">No invites yet.</p>}
        <table className="tbl">
          <tbody>
            {invites.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.email}</td><td>{roleLabel(i.role)}</td>
                <td>{i.used_at ? 'Accepted' : new Date(i.expires_at) < new Date() ? 'Expired' : 'Waiting'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
