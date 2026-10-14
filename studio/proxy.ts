import { NextResponse, type NextRequest } from 'next/server';

// Quick check only: send people without a session cookie to the sign-in page.
// The real check (is the session valid, what role) happens in getUser() next to the data.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname === '/login' || pathname.startsWith('/invite/');
  const hasCookie = req.cookies.has('studio_session');
  if (!open && !hasCookie) return NextResponse.redirect(new URL('/login', req.nextUrl));
  return NextResponse.next();
}

export const config = {
  // API routes answer 401 themselves; static assets are skipped.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
