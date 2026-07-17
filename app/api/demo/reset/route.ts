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

  // Wipe + reseed, holding the beat lock so no sync mutates a run mid-delete.
  // Retried a few times: a rare race can still slip a relation-violation through,
  // and a moment later (no beat in flight) it goes clean — so the operator never
  // sees the ugly error, just a working "Start over".
  const doReset = () =>
    runWithDemoLock(async () => {
      const { organisationId } = await ensureDemoOrg();
      await resetDemoLedger(organisationId);
      await clearShots();
      const seeded = await seedDemoSystems();
      clearSessions();
      if (isBrowserTransport()) {
        const { closeBrowser } = await import('@/lib/demo/browser');
        await closeBrowser();
      }
      return seeded;
    });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const outcome = await doReset();
      if (outcome.ok && outcome.result) {
        const seeded = outcome.result;
        return ok({
          reset: true,
          ...seeded,
          message: `Both demo systems re-seeded — ${seeded.jobs} jobs in the source, ${seeded.workOrders} work orders in the target.`,
        });
      }
      // Lock busy — wait for the in-flight beat, then try again.
    } catch (error) {
      lastErr = error;
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  if (lastErr) return handleRouteError(lastErr);
  return fail('The demo is busy syncing — give it a couple of seconds and press Start over again.', 409);
}
