import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { seedDemoSystems } from '@/lib/demo/seeder';
import { ensureDemoOrg } from '@/lib/demo/org';
import { clearSessions } from '@/lib/demo/session';
import { clearShots } from '@/lib/demo/screenshots';
import { isBrowserTransport } from '@/lib/demo/config';
import { runWithDemoLock } from '@/lib/demo/tick';
import { ingestAndSync } from '@/lib/demo/ingest';
import { demoGuard, hasWriteKey } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Start the demo over.
 *
 * Deliberately does NOT delete the ledger. seedDemoSystems advances an org epoch,
 * so ProofSync's side simply switches to a fresh, empty organisation — nothing to
 * delete, nothing to race, so reset is a fast reseed that cannot time out or hit
 * a relation-integrity error. The previous org's rows are abandoned on the
 * demo-only cluster (small, disposable). Only the two stand-in databases and the
 * control document are wiped, which are relation-free and quick.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;
  if (!hasWriteKey(req)) return fail('Unauthorised', 401);

  try {
    // Hold the beat lock so no sync is mid-write while we reseed the stand-in
    // systems. Fast now (no deletes), so this barely contends.
    const outcome = await runWithDemoLock(async () => {
      const seeded = await seedDemoSystems();
      await ensureDemoOrg(); // create the fresh (new-epoch) org + client + mappings
      await clearShots();
      clearSessions();
      // Run the batch to completion so the RESTING state is a finished run: land
      // on /dashboard, /jobs or /terminal directly and they're already populated,
      // with no need to open the live console. One big PARALLEL pass (cap raised
      // past the batch size) so it finishes in ~one sync's time rather than many
      // sequential beats — the 8-beat loop was too slow and hit the 60s ceiling.
      if (!isBrowserTransport()) {
        await ingestAndSync({ maxDispatches: 40 });
        await ingestAndSync({ maxDispatches: 40 }); // mop up any retryable stragglers
      } else {
        const { closeBrowser } = await import('@/lib/demo/browser');
        await closeBrowser();
      }
      return seeded;
    });

    if (!outcome.ok || !outcome.result) {
      return fail('The demo is busy for a moment — press Start over again.', 409);
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
