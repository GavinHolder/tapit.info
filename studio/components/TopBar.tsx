'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopBar() {
  const path = usePathname();
  return (
    <header className="top">
      <Link href="/flows" className="brand" aria-label="TapIt Studio home">
        <span className="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 32 32"><path d="M9 17c3-6 11-6 14 0M12 20c2-3 6-3 8 0" fill="none" stroke="#c8f560" strokeWidth="2.6" strokeLinecap="round" /><circle cx="16" cy="24" r="2" fill="#c8f560" /></svg>
        </span>
        TapIt Studio
      </Link>
      <nav className="nav" aria-label="Studio">
        <Link href="/flows" className={path.startsWith('/flows') ? 'on' : ''}>Flows</Link>
        <Link href="/review" className={path.startsWith('/review') ? 'on' : ''}>Mockups</Link>
      </nav>
      <span className="top-note">Runs on this machine. Nothing leaves it.</span>
    </header>
  );
}
