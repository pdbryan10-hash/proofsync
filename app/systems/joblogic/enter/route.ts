import { NextResponse, type NextRequest } from 'next/server';
import { signIn, currentUser, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/systems/auth';
import { DEMO_SOURCE_LOGIN, isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * "Open this job in Joblogic" — the human convenience link from the demo console.
 *
 * If the viewer already has a valid Joblogic session it just lands them on the
 * page. If not, it signs them in instantly with the demo credentials (a
 * machine-speed login, no form) and then lands them there. This is separate from
 * the login form the sync's browser transport drives — that still exists and is
 * still demonstrated; this is only so a presenter can jump straight to a record.
 */
export async function GET(req: NextRequest) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only ever redirect within this system's own pages — never an open redirect.
  const requested = req.nextUrl.searchParams.get('next') ?? '';
  const next = requested.startsWith('/systems/joblogic/') ? requested : '/systems/joblogic/jobs';

  // Already signed in? Straight through.
  if (await currentUser('joblogic')) {
    return NextResponse.redirect(new URL(next, req.url), 302);
  }

  const result = await signIn('joblogic', DEMO_SOURCE_LOGIN.username, DEMO_SOURCE_LOGIN.password);
  const response = NextResponse.redirect(new URL(next, req.url), 302);
  if (result.ok && result.token) {
    response.cookies.set(SESSION_COOKIE.joblogic, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/systems/joblogic',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}
