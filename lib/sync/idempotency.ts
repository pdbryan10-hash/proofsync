import { prisma } from '@/lib/db/prisma';

/**
 * Idempotency for inbound completion events (§9). Guarantees the same Joblogic
 * completion cannot update Concerto repeatedly.
 *
 * The key prefers a provider event id; otherwise it is derived deterministically
 * from (joblogicJobId, eventType, completionVersion) so re-delivered webhooks
 * collapse to one processed record.
 */
export function buildIdempotencyKey(params: {
  sourceEventId?: string | null;
  joblogicJobId: string;
  eventType: string;
  completionVersion?: string | number | null;
}): string {
  if (params.sourceEventId) return `evt:${params.sourceEventId}`;
  const version = params.completionVersion ?? 'v0';
  return `job:${params.joblogicJobId}:${params.eventType}:${version}`;
}

export async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.processedEvent.findUnique({ where: { idempotencyKey } });
  return !!existing;
}

export async function markProcessed(params: {
  idempotencyKey: string;
  sourceEventId?: string | null;
  joblogicJobId: string;
  eventType: string;
  syncRunId?: string | null;
}): Promise<void> {
  await prisma.processedEvent.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    create: {
      idempotencyKey: params.idempotencyKey,
      sourceEventId: params.sourceEventId ?? null,
      joblogicJobId: params.joblogicJobId,
      eventType: params.eventType,
      syncRunId: params.syncRunId ?? null,
    },
    update: { syncRunId: params.syncRunId ?? null },
  });
}
