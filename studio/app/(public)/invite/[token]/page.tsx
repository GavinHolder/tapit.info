'use client';

import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';

type Invite = { name: string; email: string; role: string };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Invite>(`/api/invite/${token}`).then(setInvite).catch((e: Error) => setProblem(e.message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    setError('');
    try {
      await api(`/api/invite/${token}`, { json: { password } });
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
      setBusy(false);
    }
  }

  if (problem) return <div className="auth-form"><h1>Invite not valid</h1><p className="hint">{problem}</p></div>;
  if (!invite) return <div className="auth-form"><p className="hint">Checking your invite…</p></div>;

  return (
    <form onSubmit={submit} className="auth-form">
      <h1>Welcome, {invite.name}</h1>
      <p className="hint">Choose a password for {invite.email}. Use at least 10 characters.</p>
      <label className="lbl">Password
        <input className="in" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label className="lbl">Repeat the password
        <input className="in" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
      </label>
      <div className="form-error" role="alert">{error}</div>
      <button type="submit" className="btn primary" disabled={busy || !password || !again}>{busy ? 'Creating…' : 'Create my account'}</button>
    </form>
  );
}
