import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Settings } from '@/components/Settings';

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.role !== 'owner') redirect('/inbox');
  return <Settings email={user.email} />;
}
