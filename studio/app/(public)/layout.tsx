export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 32 32"><path d="M9 17c3-6 11-6 14 0M12 20c2-3 6-3 8 0" fill="none" stroke="#c8f560" strokeWidth="2.6" strokeLinecap="round" /><circle cx="16" cy="24" r="2" fill="#c8f560" /></svg>
          </span>
          TapIt Studio
        </div>
        {children}
      </div>
    </main>
  );
}
