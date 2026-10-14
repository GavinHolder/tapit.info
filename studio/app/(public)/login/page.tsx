'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { json: { email, password } });
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <h1>Sign in</h1>
      <p className="hint">This workspace is by invitation only.</p>
      <label className="lbl">Email
        <input className="in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="lbl">Password
        <input className="in" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <div className="form-error" role="alert">{error}</div>
      <button type="submit" className="btn primary" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
