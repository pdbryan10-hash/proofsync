import { prisma } from '@/lib/db/prisma';
import { createConcertoConnector } from '@/lib/integrations/concerto/connector';
import { resolvePlannedChanges, type PlannedChange, type SourceCompletion } from './mapping-resolver';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export interface JobSyncPreview {
  changes: PlannedChange[];
  targetFound: boolean;
  targetReference: string | null;
  counts: {
    willUpdate: number;
    alreadyMatches: number;
    excluded: number;
    needsReview: number;
  };
}

/**
 * Computes the planned Concerto changes for a job WITHOUT writing anything.
 * Powers the Job Detail "Overview" and "Field Mapping" tabs so the operator
 * sees exactly what a sync will do before triggering it.
 */
export async function getJobSyncPreview(jobId: string): Promise<JobSyncPreview | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { client: true, completion: true },
  });
  if (!job || !job.completion) {
    return { changes: [], targetFound: false, targetReference: job?.concertoJobReference ?? null, counts: emptyCounts() };
  }

  const mappings = await prisma.fieldMapping.findMany({
    where: {
      organisationId: job.organisationId,
      active: true,
      OR: [{ clientId: job.clientId }, { clientId: null }],
    },
    orderBy: { sortOrder: 'asc' },
  });

  let targetFields: Record<string, unknown> | null = null;
  let targetFound = false;
  if (job.concertoJobReference) {
    const concerto = createConcertoConnector();
    const target = await concerto.getJob(job.concertoJobReference).catch(() => null);
    if (target) {
      targetFields = target.fields;
      targetFound = true;
    }
  }

  const completion: SourceCompletion = {
    arrivalTime: iso(job.completion.arrivalTime),
    departureTime: iso(job.completion.departureTime),
    timeOnSiteMinutes: job.completion.timeOnSiteMinutes,
    workCompleted: job.completion.workCompleted,
    engineerNotes: job.completion.engineerNotes,
    labourCost: job.completion.labourCost,
    materialsCost: job.completion.materialsCost,
    totalCost: job.completion.totalCost,
    followOnWorkRequired: job.completion.followOnWorkRequired,
    followOnWorkNotes: job.completion.followOnWorkNotes,
    completedAt: iso(job.completion.completedAt),
  };

  const changes = resolvePlannedChanges({
    mappings,
    completion,
    policy: job.client,
    targetFields,
    extra: { engineerName: job.engineerName, siteName: job.siteName },
  });

  return {
    changes,
    targetFound,
    targetReference: job.concertoJobReference,
    counts: {
      willUpdate: changes.filter((c) => c.status === 'WILL_UPDATE').length,
      alreadyMatches: changes.filter((c) => c.status === 'ALREADY_MATCHES').length,
      excluded: changes.filter((c) => c.status === 'EXCLUDED_BY_RULE').length,
      needsReview: changes.filter((c) => c.status === 'NEEDS_REVIEW').length,
    },
  };
}

function emptyCounts() {
  return { willUpdate: 0, alreadyMatches: 0, excluded: 0, needsReview: 0 };
}
