'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Props = { user: { name: string; role: 'owner' | 'client'; email: string } };

export function TopBar({ user }: Props) {
  const path = usePathname();
  const owner = user.role === 'owner';
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let live = true;
    const poll = () => api<{ unread: number }>('/api/inbox/summary').then((r) => live && setUnread(r.unread)).catch(() => undefined);
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
      </Link>
      <nav className="nav" aria-label="Studio">
        <Link href="/inbox" className={path.startsWith('/inbox') ? 'on' : ''}>
          Inbox{unread > 0 && <span className="badge" aria-label={`${unread} with new replies`}>{unread}</span>}
        </Link>
        <Link href="/flows" className={path.startsWith('/flows') ? 'on' : ''}>Flows</Link>
        <Link href="/review" className={path.startsWith('/review') ? 'on' : ''}>Mockups</Link>
        {owner && <Link href="/team" className={path.startsWith('/team') ? 'on' : ''}>Team</Link>}
      </nav>
      <div className="top-user">
        <span className="who">{user.name}<em>{owner ? 'Developer' : 'Client'}</em></span>
        <button type="button" className="btn small" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
