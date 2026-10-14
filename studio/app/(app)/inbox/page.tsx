import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Inbox } from '@/components/Inbox';

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await getUser();
  if (!user) redirect('/login');
  const { t } = await searchParams;
  return <Inbox role={user.role} initialId={t} />;
}
