import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

/**
 * Gate for every /api/demo/* route.
 *
 * Returns a 404 rather than a 403 when the demo is off: a disabled demo should
 * be indistinguishable from one that was never built, not advertise itself.
 *
 * The mode check is the important one. These routes seed and mutate whatever the
 * connectors point at, so running them while INTEGRATION_MODE=live would drive
 * fabricated jobs into a real client's CAFM. Refusing here means that cannot
 * happen by misconfiguration.
 */
export function demoGuard(_req: NextRequest): NextResponse | null {
  if (!isDemoEnabled()) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  if (getIntegrationMode() === 'live') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Demo routes are disabled while INTEGRATION_MODE=live — they would write fabricated data into real systems.',
      },
      { status: 409 },
    );
  }
  return null;
}

/**
 * Extra key check for the endpoints that destroy or fabricate data. Vercel Cron
 * sends CRON_SECRET as a bearer token automatically; a ?key= is accepted for
 * manual runs.
 */
export function hasWriteKey(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured → local development. The demo gate above is the control.
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('key') === secret;
}
