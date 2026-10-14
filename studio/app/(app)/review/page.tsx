import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ReviewViewer } from '@/components/ReviewViewer';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ board?: string; t?: string }> }) {
  const user = await getUser();
  if (!user) redirect('/login');
  const { board, t } = await searchParams;
  return <ReviewViewer initial={board} thread={t} role={user.role} />;
}
