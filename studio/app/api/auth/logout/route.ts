import { endSession, requireCsrf } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  await endSession();
  return Response.json({ ok: true });
}
