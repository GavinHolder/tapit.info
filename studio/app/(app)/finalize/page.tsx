import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Finalize } from '@/components/Finalize';

export default async function FinalizePage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.role !== 'owner') redirect('/inbox');
  return <Finalize />;
}
