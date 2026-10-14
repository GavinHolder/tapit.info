import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Team } from '@/components/Team';

export default async function TeamPage() {
  const user = await getUser();
  if (!user || user.role !== 'owner') redirect('/flows');
  return (
    <div className="plain">
      <h1>Team</h1>
      <Team selfId={user.id} />
    </div>
  );
}
