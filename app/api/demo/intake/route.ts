import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { runIntake } from '@/lib/demo/intake';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Run one Work Intake pass — pull jobs the client raised in Concerto and create
 * the matching Joblogic jobs (dispatched to an engineer, client reference kept).
 * The inbound half of the closed loop; the outbound sync closes it on completion.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;
  try {
    const limit = Number(new URL(req.url).searchParams.get('limit')) || undefined;
    const result = await runIntake(limit);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
