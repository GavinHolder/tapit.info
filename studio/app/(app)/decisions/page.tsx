import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Decisions } from '@/components/Decisions';

export default async function DecisionsPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  return <Decisions role={user.role} />;
}
