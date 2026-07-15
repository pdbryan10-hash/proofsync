import { prisma } from '@/lib/db/prisma';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';
import { buildIdempotencyKey } from '@/lib/sync/idempotency';

export interface PollResult {
  detected: number;
  dispatched: number;
  synced: number;
  partial: number;
  skipped: number;
  exceptions: number;
  sinceMinutes: number;
  items: Array<{ joblogicJobId: string; concertoJobReference: string | null; status: string }>;
}

/**
 * Polling ingestion (§9 POLLING trigger). Detects Joblogic jobs completed since
 * `sinceMinutes` ago and feeds each into Concerto via the sync engine. Intended
 * to run on a schedule (Vercel cron, every 30 minutes) as a safety net that
 * complements real-time webhooks — so a missed or unconfigured webhook never
 * leaves a completed job un-synced.
 *
 * Every dispatch is idempotent: a job already synced for this completion version
 * is ignored, so repeated polling never double-updates Concerto.
 */
export async function pollAndSyncCompletions(sinceMinutes = 45): Promise<PollResult> {
  const since = new Date(Date.now() - sinceMinutes * 60_000);
  const joblogic = createJoblogicConnector();
  const dispatcher = getSyncDispatcher();

  // 1. Ask the source system for recently-completed jobs.
  const completed = await joblogic.getCompletedJobs(since);

  const result: PollResult = {
    detected: completed.length,
    dispatched: 0,
    synced: 0,
    partial: 0,
    skipped: 0,
    exceptions: 0,
    sinceMinutes,
    items: [],
  };

  for (const remote of completed) {
    // 2. Resolve the local job record.
    const job = await prisma.job.findFirst({ where: { joblogicJobId: remote.joblogicJobId } });
    if (!job) continue;

    // 3. Only feed jobs that are awaiting sync — never re-drive terminal ones.
    if (!['PENDING', 'READY'].includes(job.syncStatus)) {
      result.skipped += 1;
      result.items.push({
        joblogicJobId: job.joblogicJobId,
        concertoJobReference: job.concertoJobReference,
        status: `skipped (${job.syncStatus})`,
      });
      continue;
    }

    const completionVersion = job.updatedAt.getTime().toString();
    const idempotencyKey = buildIdempotencyKey({
      joblogicJobId: job.joblogicJobId,
      eventType: 'job.completed',
      completionVersion,
    });

    const dispatch = await dispatcher.dispatch({
      jobId: job.id,
      triggerType: 'POLLING',
      idempotencyKey,
      eventType: 'job.completed',
      completionVersion,
    });

    result.dispatched += 1;
    if (dispatch.status === 'SUCCESS') result.synced += 1;
    else if (dispatch.status === 'PARTIAL') result.partial += 1;
    else if (dispatch.skipped) result.skipped += 1;
    else result.exceptions += 1;

    result.items.push({
      joblogicJobId: job.joblogicJobId,
      concertoJobReference: job.concertoJobReference,
      status: dispatch.status,
    });
  }

  // 4. Stamp the last successful poll on the Joblogic connection.
  await prisma.integrationConnection.updateMany({
    where: { provider: 'JOBLOGIC' },
    data: { lastConnectionTestAt: new Date() },
  });

  return result;
}
