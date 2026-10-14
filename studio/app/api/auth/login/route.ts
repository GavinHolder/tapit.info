import { checkLogin, clearFailures, loginKeys, lockedFor, recordFailure, requireCsrf, startSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return Response.json({ error: 'Enter your email and password.' }, { status: 400 });

  const keys = loginKeys(req, email);
  const wait = lockedFor(keys);
  if (wait > 0) {
    return Response.json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minutes.` }, { status: 429 });
  }

  const found = checkLogin(email, password);
  if (!found) {
    recordFailure(keys);
    return Response.json({ error: 'That email or password is not right.' }, { status: 401 });
  }
  clearFailures(keys);
  await startSession(found.id);
  return Response.json({ ok: true });
}
