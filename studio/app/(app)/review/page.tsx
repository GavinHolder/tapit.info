import { ReviewViewer } from '@/components/ReviewViewer';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const { board } = await searchParams;
  return <ReviewViewer initial={board} />;
}
