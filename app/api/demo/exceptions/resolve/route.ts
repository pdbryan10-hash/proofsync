import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { prisma } from '@/lib/db/prisma';
import { SyncStatus, ExceptionStatus } from '@/lib/domain/enums';
import { sourceJobs, targetWorkOrders } from '@/lib/demo/mongo';
import { ensureDemoOrg } from '@/lib/demo/org';
import { runTick } from '@/lib/demo/tick';
import { demoGuard } from '../../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Resolve one "needs a person" exception, the way a coordinator would: supply the
 * field Concerto demanded, or correct the value it rejected, then resubmit. This
 * is the ONLY way "set aside for a person" ever goes down — nothing self-heals.
 *
 * MISSING_FIELD  → write the value straight into Concerto (a field Joblogic never
 *                  captured), clear the block, re-queue.
 * INVALID_VALUE  → correct the value AT SOURCE (bumping the revision so the engine
 *                  re-syncs the fixed record), clear the block, re-queue.
 *
 * Then a beat is nudged so the job visibly crosses within a second or two.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    const body = (await req.json().catch(() => ({}))) as { reference?: string; value?: string };
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    const value = typeof body.value === 'string' ? body.value.trim() : '';
    if (!reference) return fail('A work order reference is required.', 400);
    if (!value) return fail('Please enter a value before resubmitting.', 400);

    const wos = await targetWorkOrders();
    const wo = await wos.findOne({ reference });
    if (!wo) return fail('That work order no longer exists.', 404);
    if (!wo.demoBlock) return fail('That job has already been resolved.', 409);

    const block = wo.demoBlock;

    if (block.kind === 'MISSING_FIELD' && block.attribute) {
      await wos.updateOne(
        { reference },
        { $set: { [`attributes.${block.attribute}`]: value, demoBlock: null } },
      );
    } else if (block.kind === 'INVALID_VALUE' && block.sourceField) {
      // Fix it at source and bump the revision — the engine treats an edited
      // completion sheet as newly syncable, exactly as a real re-open would.
      const jobs = await sourceJobs();
      await jobs.updateOne(
        { customerOrderRef: reference },
        { $set: { [`completionSheet.${block.sourceField}`]: value }, $inc: { revision: 1 } },
      );
      await wos.updateOne({ reference }, { $set: { demoBlock: null } });
    } else {
      return fail('This exception cannot be resolved automatically.', 422);
    }

    // Re-queue ProofSync's own record and close the open exception, attributing it
    // to the person who acted.
    const { organisationId } = await ensureDemoOrg();
    const job = await prisma.job.findFirst({
      where: { organisationId, concertoJobReference: reference },
      select: { id: true },
    });
    if (job) {
      await prisma.job.update({
        where: { id: job.id },
        data: { syncStatus: SyncStatus.PENDING },
      });
      await prisma.exception.updateMany({
        where: { jobId: job.id, status: { in: [ExceptionStatus.OPEN, ExceptionStatus.IN_REVIEW] } },
        data: {
          status: ExceptionStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy: 'Demo coordinator',
          resolutionNotes: `Resolved from the demo: ${block.label} supplied and resubmitted.`,
        },
      });
    }

    // Nudge a beat so it crosses now rather than on the next poll. Best-effort:
    // if a beat is already running, the re-queued job syncs on the following one.
    await runTick({ force: true }).catch(() => {});

    return ok({ resolved: true, reference });
  } catch (error) {
    return handleRouteError(error);
  }
}
