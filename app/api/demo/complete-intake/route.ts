import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { completeIntakeJobs } from '@/lib/demo/intake';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * The middle beat of the closed loop: the engineer completes the jobs Work Intake
 * dispatched into Joblogic. Simulated here so the outbound sync can then return
 * the result to the client system and verify it.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;
  try {
    const result = await completeIntakeJobs();
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
