import { NextResponse, type NextRequest } from 'next/server';
import { signIn, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/systems/auth';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Concerto's log-in handler. Note the field names differ from Joblogic's. */
export async function POST(req: NextRequest) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const form = await req.formData();
  const username = String(form.get('userid') ?? '');
  const password = String(form.get('passphrase') ?? '');
  const next = String(form.get('next') ?? '') || '/systems/concerto/work-orders';

  const result = await signIn('concerto', username, password);

  if (!result.ok) {
    const url = new URL('/systems/concerto/login', req.url);
    url.searchParams.set('error', result.error ?? 'Log-in failed.');
    if (next) url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, req.url), 303);
  response.cookies.set(SESSION_COOKIE.concerto, result.token!, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/systems/concerto',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
