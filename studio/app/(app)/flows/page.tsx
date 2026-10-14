import { getUser } from '@/lib/auth';
import { Workspace } from '@/components/Workspace';

export default async function FlowsPage() {
  const user = await getUser();
  return <Workspace readOnly={user?.role !== 'owner'} />;
}
