import { prisma } from '@/lib/db/prisma';
import { ExceptionStatus, SyncStatus } from '@/lib/domain/enums';
import { isValidConcertoReference } from '@/lib/domain/validation';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';
import type { ResolveExceptionInput } from '@/lib/domain/validation';

export interface ResolveExceptionOutcome {
  ok: boolean;
  message: string;
  exceptionStatus: string;
  syncStatus?: string;
  syncRunId?: string | null;
}

/**
 * Resolves an exception. Supports the key demo flow: supply a missing Concerto
 * reference, then retry the sync. If a fresh sync succeeds the exception is
 * closed as RESOLVED; otherwise it is reopened for further review.
 */
export async function resolveException(
  exceptionId: string,
  input: ResolveExceptionInput,
): Promise<ResolveExceptionOutcome> {
  const exception = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: { job: true },
  });
  if (!exception) return { ok: false, message: 'Exception not found.', exceptionStatus: 'OPEN' };

  // If a corrected Concerto reference is supplied, validate and store it.
  if (input.concertoJobReference) {
    if (!isValidConcertoReference(input.concertoJobReference)) {
      return {
        ok: false,
        message: 'The Concerto reference is not in the expected format (e.g. CON-284811).',
        exceptionStatus: exception.status,
      };
    }
    await prisma.job.update({
      where: { id: exception.jobId },
      data: { concertoJobReference: input.concertoJobReference, syncStatus: SyncStatus.READY },
    });
  }

  // Manual resolution without retry (operator judgement).
  if (!input.retry) {
    const updated = await prisma.exception.update({
      where: { id: exceptionId },
      data: {
        status: ExceptionStatus.RESOLVED,
        resolutionNotes: input.resolutionNotes ?? 'Resolved manually.',
        resolvedBy: input.resolvedBy ?? 'operator',
        resolvedAt: new Date(),
      },
    });
    return { ok: true, message: 'Exception marked resolved.', exceptionStatus: updated.status };
  }

  // Mark retrying, then dispatch a fresh sync attempt.
  await prisma.exception.update({
    where: { id: exceptionId },
    data: { status: ExceptionStatus.RETRYING },
  });

  const dispatcher = getSyncDispatcher();
  const result = await dispatcher.dispatch({ jobId: exception.jobId, triggerType: 'RETRY' });

  const succeeded = result.status === 'SUCCESS' || result.status === 'PARTIAL';
  if (succeeded) {
    const updated = await prisma.exception.update({
      where: { id: exceptionId },
      data: {
        status: ExceptionStatus.RESOLVED,
        resolutionNotes:
          input.resolutionNotes ??
          (input.concertoJobReference
            ? `Concerto reference set to ${input.concertoJobReference} and sync retried successfully.`
            : 'Sync retried successfully.'),
        resolvedBy: input.resolvedBy ?? 'operator',
        resolvedAt: new Date(),
      },
    });
    return {
      ok: true,
      message: 'Sync retried successfully — exception resolved.',
      exceptionStatus: updated.status,
      syncStatus: result.status,
      syncRunId: result.syncRunId,
    };
  }

  // Retry failed — reopen for review. The engine will have raised a new
  // exception describing the fresh failure.
  const updated = await prisma.exception.update({
    where: { id: exceptionId },
    data: { status: ExceptionStatus.IN_REVIEW },
  });
  return {
    ok: false,
    message: `Retry did not succeed (${result.message}). Exception returned for review.`,
    exceptionStatus: updated.status,
    syncStatus: result.status,
    syncRunId: result.syncRunId,
  };
}
