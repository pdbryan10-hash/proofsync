import { NextResponse, type NextRequest } from 'next/server';
import { signOut, SESSION_COOKIE } from '@/lib/systems/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await signOut('joblogic');
  const response = NextResponse.redirect(new URL('/systems/joblogic/login', req.url), 303);
  response.cookies.delete(SESSION_COOKIE.joblogic);
  return response;
}
