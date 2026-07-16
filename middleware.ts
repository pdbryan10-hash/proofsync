import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-aware routing.
 *
 * One deployment serves two faces:
 *   proofsync.co.uk      → the sales pages (marketing group at `/`)
 *   app.proofsync.co.uk  → the product itself, so the root IS the dashboard
 *
 * Only the bare root is rewritten; every other path (including /api/*, the
 * webhook and the cron) passes straight through untouched.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const isAppHost = host.startsWith('app.');

  if (isAppHost && req.nextUrl.pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    // REDIRECT, not rewrite. The marketing `/` is statically generated, so both
    // hosts share one edge-cache entry for that path — a rewrite gets served the
    // cached sales page at random. A redirect changes the URL and sidesteps the
    // shared cache entirely.
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets; everything else falls through the no-op above.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
