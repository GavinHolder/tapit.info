'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PasswordPanel } from './PasswordPanel';

type Props = { user: { name: string; role: 'owner' | 'client'; email: string } };

export function TopBar({ user }: Props) {
  const path = usePathname();
  const owner = user.role === 'owner';
  const [unread, setUnread] = useState(0);
  const [decisions, setDecisions] = useState(0);
  const [pw, setPw] = useState(false);
  const [mail, setMail] = useState<{ enabled: boolean; on: boolean } | null>(null);

  useEffect(() => {
    void api<{ mailEnabled: boolean; notifyEmail: boolean }>('/api/me/prefs').then((r) => setMail({ enabled: r.mailEnabled, on: r.notifyEmail })).catch(() => undefined);
  }, []);

  async function toggleMail() {
    if (!mail) return;
    const next = !mail.on;
    setMail({ ...mail, on: next });
    try { await api('/api/me/prefs', { method: 'PATCH', json: { notifyEmail: next } }); } catch { setMail(mail); }
  }

  useEffect(() => {
    let live = true;
    const poll = () => api<{ unread: number; decisions: number }>('/api/inbox/summary').then((r) => { if (live) { setUnread(r.unread); setDecisions(r.decisions); } }).catch(() => undefined);
    void poll();
    const t = setInterval(poll, 20000);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    window.addEventListener('studio:inbox', onFocus);
    return () => { live = false; clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener('studio:inbox', onFocus); };
  }, [path]);

  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
    window.location.href = '/login';
  }

  return (
    <header className="top">
      <Link href={owner ? '/flows' : '/inbox'} className="brand" aria-label="TapIt Studio home">
        <span className="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 32 32"><path d="M9 17c3-6 11-6 14 0M12 20c2-3 6-3 8 0" fill="none" stroke="#c8f560" strokeWidth="2.6" strokeLinecap="round" /><circle cx="16" cy="24" r="2" fill="#c8f560" /></svg>
        </span>
        TapIt Studio
        <span className="ver" title="Studio version. Features listed in What is new need this version or later.">v{process.env.NEXT_PUBLIC_STUDIO_VERSION}</span>
      </Link>
      <nav className="nav" aria-label="Studio">
        <Link href="/inbox" className={path.startsWith('/inbox') ? 'on' : ''}>
          Inbox{unread > 0 && <span className="badge" aria-label={`${unread} with new replies`}>{unread}</span>}
        </Link>
        <Link href="/decisions" className={path.startsWith('/decisions') ? 'on' : ''}>
          Decisions{decisions > 0 && <span className="badge" aria-label={`${decisions} waiting`}>{decisions}</span>}
        </Link>
        <Link href="/flows" className={path.startsWith('/flows') ? 'on' : ''}>Flows</Link>
        <Link href="/review" className={path.startsWith('/review') ? 'on' : ''}>Mockups</Link>
        {owner && <Link href="/finalize" className={path.startsWith('/finalize') ? 'on' : ''}>Finalize</Link>}
        {owner && <Link href="/team" className={path.startsWith('/team') ? 'on' : ''}>Team</Link>}
      </nav>
      <div className="top-user">
        <span className="who">{user.name}<em>{owner ? 'Developer' : 'Client'}</em></span>
        {mail?.enabled && <button type="button" className="btn small" aria-pressed={mail.on} onClick={toggleMail} title="Email me when someone replies">{mail.on ? 'Email on' : 'Email off'}</button>}
        <button type="button" className="btn small" onClick={() => setPw(true)}>Password</button>
        <button type="button" className="btn small" onClick={signOut}>Sign out</button>
      </div>
    {pw && <PasswordPanel onClose={() => setPw(false)} />}
    </header>
  );
}
