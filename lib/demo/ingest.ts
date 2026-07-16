import { prisma } from '@/lib/db/prisma';
import { DocumentType, SyncStatus } from '@/lib/domain/enums';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';
import { buildIdempotencyKey } from '@/lib/sync/idempotency';
import { ensureDemoOrg } from './org';
import { getMaxDispatchesPerTick } from './config';
import type { NormalisedJob, NormalisedCompletion } from '@/lib/integrations/types';

/**
 * Ingest + sync for the live demo.
 *
 * ProofSync keeps its OWN record of every job it has seen in the source system,
 * then drives the sync from that record. That is not demo scaffolding — it is
 * how the product has to work: you cannot hold an audit trail, an idempotency
 * ledger or a retry queue against a system you only get to read.
 *
 * The important thing about this file is how little it does. It mirrors DB1 into
 * ProofSync's tables and calls the real dispatcher. Everything after that — the
 * stages, the field mapping, the client policy, the verification, the exception
 * handling — is production code that has no idea it is in a demo.
 */

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

export interface IngestResult {
  seen: number;
  ingested: number;
  updated: number;
  dispatched: number;
  synced: number;
  partial: number;
  ignored: number;
  exceptions: number;
  /** Ready to sync but held back by the per-beat cap — never silently dropped. */
  deferred: number;
}

/**
 * Look back far enough to catch anything missed while nobody was watching. Cheap
 * and safe: the idempotency ledger makes re-seeing a job a no-op, so a wide
 * window costs a query rather than a duplicate write into a client's system.
 */
const LOOKBACK_MINUTES = 60 * 24;

/**
 * Most syncs a single beat will execute — see getMaxDispatchesPerTick().
 *
 * A direct sync takes ~4.5s; a browser-driven one 10–20s. The route's
 * maxDuration is 60s, so an unbounded beat clearing a backlog would be killed
 * mid-flight, leaving a job marked SYNCING forever. Anything over the cap stays
 * PENDING for the next beat, which is the right behaviour regardless: work is
 * deferred, never dropped. `deferred` is reported rather than swallowed, so a
 * beat that truncates says so.
 */

export async function ingestAndSync(): Promise<IngestResult> {
  const { organisationId, clientId } = await ensureDemoOrg();
  const joblogic = createJoblogicConnector();
  const dispatcher = getSyncDispatcher();

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000);
  const completed = await joblogic.getCompletedJobs(since);

  const result: IngestResult = {
    seen: completed.length,
    ingested: 0,
    updated: 0,
    dispatched: 0,
    synced: 0,
    partial: 0,
    ignored: 0,
    exceptions: 0,
    deferred: 0,
  };

  for (const remote of completed) {
    const completion = await joblogic.getJobCompletion(remote.joblogicJobId);
    if (!completion) continue;

    const { jobId, isNew, revisionChanged } = await mirrorJob({
      organisationId,
      clientId,
      remote,
      completion,
    });
    if (isNew) result.ingested += 1;
    else if (revisionChanged) result.updated += 1;

    await mirrorDocuments(jobId, joblogic, remote.joblogicJobId, completion);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) continue;

    // Only feed work that is waiting. Terminal states are never re-driven — a
    // synced job stays synced until the engineer actually changes something.
    if (!['PENDING', 'READY'].includes(job.syncStatus)) continue;

    // Leave the overflow PENDING for the next beat rather than risk the function
    // being killed mid-sync with a job stuck in SYNCING.
    if (result.dispatched >= getMaxDispatchesPerTick()) {
      result.deferred += 1;
      continue;
    }

    const completionVersion = completion.completionVersion ?? '1';
    const dispatch = await dispatcher.dispatch({
      jobId,
      triggerType: 'POLLING',
      idempotencyKey: buildIdempotencyKey({
        joblogicJobId: remote.joblogicJobId,
        eventType: 'job.completed',
        completionVersion,
      }),
      eventType: 'job.completed',
      completionVersion,
    });

    result.dispatched += 1;
    if (dispatch.status === 'SUCCESS') result.synced += 1;
    else if (dispatch.status === 'PARTIAL') result.partial += 1;
    else if (dispatch.skipped) result.ignored += 1;
    else result.exceptions += 1;
  }

  await prisma.integrationConnection.updateMany({
    where: { organisationId },
    data: { lastConnectionTestAt: new Date() },
  });

  return result;
}

/** Mirror one source job into ProofSync's own tables. */
async function mirrorJob(params: {
  organisationId: string;
  clientId: string;
  remote: NormalisedJob;
  completion: NormalisedCompletion;
}): Promise<{ jobId: string; isNew: boolean; revisionChanged: boolean }> {
  const { organisationId, clientId, remote, completion } = params;

  const existing = await prisma.job.findUnique({
    where: { organisationId_joblogicJobId: { organisationId, joblogicJobId: remote.joblogicJobId } },
    include: { completion: true },
  });

  const incomingVersion = completion.completionVersion ?? '1';
  const storedVersion = existing?.completion?.sourceCompletionVersion ?? null;
  const revisionChanged = !!existing && storedVersion !== null && storedVersion !== incomingVersion;

  const jobData = {
    concertoJobReference: remote.concertoJobReference,
    siteName: remote.siteName,
    siteAddress: remote.siteAddress,
    assetReference: remote.assetReference,
    jobDescription: remote.jobDescription,
    engineerName: remote.engineerName,
    joblogicStatus: remote.joblogicStatus,
    scheduledDate: toDate(remote.scheduledDate),
    completedAt: toDate(remote.completedAt),
  };

  const job = await prisma.job.upsert({
    where: { organisationId_joblogicJobId: { organisationId, joblogicJobId: remote.joblogicJobId } },
    create: {
      organisationId,
      clientId,
      joblogicJobId: remote.joblogicJobId,
      ...jobData,
      concertoStatus: 'In Progress',
      syncStatus: SyncStatus.PENDING,
    },
    update: {
      ...jobData,
      // An engineer editing the sheet makes the job syncable again. Without
      // this it would sit SYNCED and the correction would never reach the
      // client — the exact silent failure this product exists to prevent.
      ...(revisionChanged ? { syncStatus: SyncStatus.PENDING } : {}),
    },
  });

  const completionData = {
    arrivalTime: toDate(completion.arrivalTime),
    departureTime: toDate(completion.departureTime),
    timeOnSiteMinutes: completion.timeOnSiteMinutes,
    workCompleted: completion.workCompleted,
    engineerNotes: completion.engineerNotes,
    labourCost: completion.labourCost,
    materialsCost: completion.materialsCost,
    totalCost: completion.totalCost,
    followOnWorkRequired: completion.followOnWorkRequired,
    followOnWorkNotes: completion.followOnWorkNotes,
    completedAt: toDate(completion.completedAt),
    sourceCompletionVersion: incomingVersion,
    rawSourcePayload: JSON.stringify(completion.raw),
  };

  await prisma.jobCompletion.upsert({
    where: { jobId: job.id },
    create: { jobId: job.id, ...completionData },
    update: completionData,
  });

  return { jobId: job.id, isNew: !existing, revisionChanged };
}

/**
 * Mirror the source system's attachments. Keyed on the FOREIGN document id, so
 * re-ingesting the same job never duplicates paperwork.
 */
async function mirrorDocuments(
  jobId: string,
  joblogic: ReturnType<typeof createJoblogicConnector>,
  joblogicJobId: string,
  completion: NormalisedCompletion,
): Promise<void> {
  const remoteDocs = await joblogic.getJobDocuments(joblogicJobId);
  if (remoteDocs.length === 0) return;

  const existing = await prisma.document.findMany({ where: { jobId } });
  const known = new Set(existing.map((d) => d.sourceDocumentId).filter(Boolean));

  // Reuse the completion we already fetched. Re-asking the connector costs a
  // whole page load under the browser transport, for data we are holding.
  //
  // Note the browser transport's raw payload has no attachment list — the screen
  // never renders the "this upload will fail" flag, because no real system would.
  // So document-rejection faults simply don't arise there, which is honest: an
  // access method that cannot see something should not act on it.
  const rawAttachments = Array.isArray((completion.raw as Record<string, unknown>)?.attachments)
    ? ((completion.raw as Record<string, unknown>).attachments as Array<Record<string, unknown>>)
    : [];

  for (const doc of remoteDocs) {
    if (known.has(doc.sourceDocumentId)) continue;
    const source = rawAttachments.find((a) => a.attachmentId === doc.sourceDocumentId);
    await prisma.document.create({
      data: {
        jobId,
        sourceSystem: 'JOBLOGIC',
        sourceDocumentId: doc.sourceDocumentId,
        filename: doc.filename,
        mimeType: doc.mimeType,
        documentType: doc.documentType ?? DocumentType.OTHER,
        sizeBytes: doc.sizeBytes,
        sourceUrl: doc.sourceUrl,
        // Carry the source's "this upload will be rejected" hook onto our own
        // record, which is where the target connector looks for it.
        mockUploadShouldFail: source?.rejectOnUpload === true,
      },
    });
  }
}
