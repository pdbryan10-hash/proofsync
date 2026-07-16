import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { runTick } from '@/lib/demo/tick';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Headless backstop for the demo beat.
 *
 * Vercel Cron's floor is one minute, so this CANNOT deliver the 30-second
 * cadence on its own — the open console does that by pinging /api/demo/tick.
 * This exists so the demo still advances when nobody has a tab open: a client
 * opening the link cold sees a system that has been running, not one frozen
 * where the last viewer left it.
 *
 * Beats are claimed atomically, so this and a live console never double-tick.
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('key') === secret;
}

async function run(req: NextRequest) {
  // Silent no-op rather than an error: this cron is registered in vercel.json
  // for every deployment, including the ones where the demo is switched off.
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return ok({ ran: false, reason: 'demo-disabled' });
  }
  if (!isAuthorised(req)) return fail('Unauthorised', 401);

  try {
    return ok(await runTick());
  } catch (error) {
    return handleRouteError(error);
  }
}

export const GET = run;
export const POST = run;
