export const dynamic = 'force-dynamic';

// Used by Docker to tell whether the app is up. Reveals nothing.
export function GET() {
  return Response.json({ ok: true });
}
