import { NextResponse, type NextRequest } from 'next/server';
import { signIn, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/systems/auth';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Joblogic's sign-in handler: verify, set the session cookie, land on the job list. */
export async function POST(req: NextRequest) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const form = await req.formData();
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '') || '/systems/joblogic/jobs';

  const result = await signIn('joblogic', username, password);

  if (!result.ok) {
    const url = new URL('/systems/joblogic/login', req.url);
    url.searchParams.set('error', result.error ?? 'Sign-in failed.');
    if (next) url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  // 303 so the browser follows with GET — a POST-redirect-GET, as any login is.
  const response = NextResponse.redirect(new URL(next, req.url), 303);
  response.cookies.set(SESSION_COOKIE.joblogic, result.token!, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/systems/joblogic',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
