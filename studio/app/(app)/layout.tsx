import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');
  return (
    <>
      <TopBar user={user} />
      <main className="page">{children}</main>
    </>
  );
}
