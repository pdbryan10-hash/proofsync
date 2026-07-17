import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { prisma } from '@/lib/db/prisma';
import { SyncStatus } from '@/lib/domain/enums';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { ensureDemoOrg } from '@/lib/demo/org';
import { runWithDemoLock } from '@/lib/demo/tick';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Rewind the SAME batch so it can be watched crossing again, live, from empty —
 * without reseeding. Empties every Concerto work order and re-queues every job,
 * then the running beats process them once more. Unlike "Start over" this keeps
 * the exact same jobs (and any exceptions already resolved stay resolved).
 *
 * Held under the beat lock so it can't race a sync mid-flight.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    const outcome = await runWithDemoLock(async () => {
      // 1. Wipe what ProofSync had written into the client's system — but keep the
      //    demoBlock hooks so the same exceptions re-occur.
      const wos = await targetWorkOrders();
      await wos.updateMany(
        {},
        {
          $set: {
            attributes: {},
            documents: [],
            lastUpdatedBy: null,
            status: 'Awaiting Contractor',
            simulateUpdateFailure: false,
          },
        },
      );

      // 2. Clear ProofSync's ledger for this org and re-queue every job.
      const { organisationId } = await ensureDemoOrg();
      const jobs = await prisma.job.findMany({ where: { organisationId }, select: { id: true } });
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length) {
        const runs = await prisma.syncRun.findMany({
          where: { jobId: { in: jobIds } },
          select: { id: true },
        });
        const runIds = runs.map((r) => r.id);
        if (runIds.length) await prisma.syncEvent.deleteMany({ where: { syncRunId: { in: runIds } } });
        await prisma.exception.deleteMany({ where: { jobId: { in: jobIds } } });
        if (runIds.length) await prisma.syncRun.deleteMany({ where: { id: { in: runIds } } });
        await prisma.job.updateMany({
          where: { id: { in: jobIds } },
          data: { syncStatus: SyncStatus.PENDING },
        });
      }
      return { requeued: jobIds.length };
    });

    if (!outcome.ok) return ok({ replayed: false, busy: true });
    return ok({ replayed: true, ...outcome.result });
  } catch (error) {
    return handleRouteError(error);
  }
}
