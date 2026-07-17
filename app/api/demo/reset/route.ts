import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { seedDemoSystems } from '@/lib/demo/seeder';
import { ensureDemoOrg, resetDemoLedger } from '@/lib/demo/org';
import { clearSessions } from '@/lib/demo/session';
import { clearShots } from '@/lib/demo/screenshots';
import { isBrowserTransport } from '@/lib/demo/config';
import { runWithDemoLock } from '@/lib/demo/tick';
import { demoGuard, hasWriteKey } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Wipe and re-seed the whole demo: both stand-in databases and ProofSync's own
 * ledger for the demo tenant.
 *
 * Scoped deliberately. It deletes everything in the two demo databases (which
 * exist for nothing else) and, on ProofSync's side, only rows belonging to the
 * demo Organisation. The seeded product-tour org that /dashboard renders is not
 * reachable from here.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;
  if (!hasWriteKey(req)) return fail('Unauthorised', 401);

  try {
    // Hold the beat lock across the whole wipe+reseed, so no sync is running —
    // and mutating a run mid-delete — while we do it.
    const outcome = await runWithDemoLock(async () => {
      const { organisationId } = await ensureDemoOrg();
      await resetDemoLedger(organisationId);
      await clearShots();
      const seeded = await seedDemoSystems();
      clearSessions();

      if (isBrowserTransport()) {
        // The browser holds cookies for users that no longer exist after a
        // reseed. Drop it so the next beat signs in again.
        const { closeBrowser } = await import('@/lib/demo/browser');
        await closeBrowser();
      }
      return seeded;
    });

    if (!outcome.ok || !outcome.result) {
      return fail('The demo is mid-sync right now — give it a moment and press Start over again.', 409);
    }

    const seeded = outcome.result;
    return ok({
      reset: true,
      ...seeded,
      message: `Both demo systems re-seeded — ${seeded.jobs} jobs in the source, ${seeded.workOrders} work orders in the target.`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
