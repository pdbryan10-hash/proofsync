import { NextResponse, type NextRequest } from 'next/server';
import { signIn, currentUser, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/systems/auth';
import { DEMO_TARGET_LOGIN, isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * "Open this job in Concerto" — the human convenience link from the demo console.
 *
 * Lands the viewer on the work order, signing them in instantly with the demo
 * credentials first if they don't already hold a Concerto session. Separate from
 * the login the sync's browser transport drives.
 */
export async function GET(req: NextRequest) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const requested = req.nextUrl.searchParams.get('next') ?? '';
  const next = requested.startsWith('/systems/concerto/') ? requested : '/systems/concerto/work-orders';

  if (await currentUser('concerto')) {
    return NextResponse.redirect(new URL(next, req.url), 302);
  }

  const result = await signIn('concerto', DEMO_TARGET_LOGIN.username, DEMO_TARGET_LOGIN.password);
  const response = NextResponse.redirect(new URL(next, req.url), 302);
  if (result.ok && result.token) {
    response.cookies.set(SESSION_COOKIE.concerto, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/systems/concerto',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}
