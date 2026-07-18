import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { runTick } from '@/lib/demo/tick';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
// A beat completes one or more syncs, each paced through seven stages. The
// browser transport is slow (Browserbase connect + login + fill + save + verify
// against cold pages runs 60-90s for a single job), so this needs headroom
// beyond the 60s default — requires a Vercel plan that permits it (Pro: 300s).
export const maxDuration = 180;

/**
 * Advance the demo by one beat, if one is due.
 *
 * Safe to call as often as you like — the beat is claimed atomically inside
 * runTick(), so callers arriving early are told how long is left and nothing
 * happens. That is why the console can ping this every few seconds and still
 * produce an exactly-30-second cadence.
 *
 * `?force=1` runs a beat immediately regardless of the interval — the console's
 * "Force a beat" button, for when you are demonstrating and do not want to wait.
 */
async function run(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';
    const burstRaw = Number(url.searchParams.get('burst'));
    const burst = Number.isFinite(burstRaw) && burstRaw > 0 ? Math.min(burstRaw, 8) : undefined;
    const result = await runTick({ force, burst });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const GET = run;
export const POST = run;
