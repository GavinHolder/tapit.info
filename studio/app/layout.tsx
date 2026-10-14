import type { Metadata } from 'next';
import './globals.css';
import { TopBar } from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'TapIt Studio',
  description: 'Plan the TapIt flows and review the mockups. Self-hosted.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
