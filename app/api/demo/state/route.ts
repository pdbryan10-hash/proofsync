import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { getDemoState } from '@/lib/demo/state';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';

/**
 * All three panels in one read. Polled by the console; performs no writes, so it
 * can be hit as often as the UI likes without disturbing the beat.
 */
export async function GET(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    return ok(await getDemoState());
  } catch (error) {
    return handleRouteError(error);
  }
}
