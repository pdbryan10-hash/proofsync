import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { pollAndSyncCompletions } from '@/lib/services/poller';

export const dynamic = 'force-dynamic';
// Give the scheduled run room to process a batch of completions.
export const maxDuration = 60;

/**
 * Scheduled completion poller (§9). Runs every 30 minutes on Vercel Cron (see
 * vercel.json) to detect newly-completed Joblogic jobs and feed them into
 * Concerto — a safety net alongside real-time webhooks.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * when CRON_SECRET is set. A `?key=` query param is also accepted for manual
 * runs. If CRON_SECRET is unset (local demo) the endpoint is open but logs a
 * warning — set CRON_SECRET in production.
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron] CRON_SECRET not set — poll endpoint is unauthenticated (demo mode).');
    return true;
  }
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get('key');
  return key === secret;
}

async function run(req: NextRequest) {
  try {
    if (!isAuthorised(req)) return fail('Unauthorised', 401);
    const sinceParam = Number(new URL(req.url).searchParams.get('sinceMinutes'));
    const sinceMinutes = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : 45;
    const result = await pollAndSyncCompletions(sinceMinutes);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

// Vercel Cron issues GET requests; POST supports manual triggering from the UI.
export const GET = run;
export const POST = run;
