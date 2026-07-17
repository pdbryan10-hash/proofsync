import { prisma } from '@/lib/db/prisma';
import { usesSimulatedTransport } from '@/lib/config';
import {
  SyncRunStatus,
  SyncStatus,
  EventLevel,
  ExceptionStatus,
  DocumentTransferStatus,
  TriggerType as TriggerTypeEnum,
  type TriggerType,
} from '@/lib/domain/enums';
import { isValidConcertoReference } from '@/lib/domain/validation';
import { isAllowedDocument } from '@/lib/domain/validation';
import {
  MissingReferenceError,
  TargetNotFoundError,
  DuplicateTargetError,
  DocumentTransferError,
  IntegrationError,
  isRetryableError,
  toErrorCode,
  toExceptionType,
  toExceptionSeverity,
  toSafeMessage,
} from '@/lib/errors/integration-errors';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';
import { createConcertoConnector } from '@/lib/integrations/concerto/connector';
import { SyncAuditLog } from './audit';
import {
  resolvePlannedChanges,
  buildUpdatePayload,
  type SourceCompletion,
} from './mapping-resolver';
import { buildIdempotencyKey, isAlreadyProcessed, markProcessed } from './idempotency';
import type { SyncDispatchRequest, SyncDispatchResult } from './dispatcher';

/**
 * Per-stage delay so a sync is legible to someone watching — machine-fast, but
 * not instant. Applied only when the far side is a stand-in (mock or demo),
 * never against live APIs where the real latency is the truth. Tunable via
 * DEMO_STAGE_DELAY_MS; the default keeps a whole sync to roughly a second.
 */
function stageDelayMs(): number {
  const raw = Number(process.env.DEMO_STAGE_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 120;
}
const STAGE_DELAY_MS = usesSimulatedTransport() ? stageDelayMs() : 0;
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * JobCompletionSyncService — the explicit JOBLOGIC → CONCERTO sync workflow (§10).
 *
 * Guarantees:
 *   - Never silently fails: every run ends in SUCCESS, PARTIAL, or an Exception.
 *   - Never updates Concerto without a valid, unique reference match.
 *   - Records a full audit trail of every stage.
 */
export class JobCompletionSyncService {
  private readonly joblogic = createJoblogicConnector();
  private readonly concerto = createConcertoConnector();

  async run(request: SyncDispatchRequest): Promise<SyncDispatchResult> {
    const startedAt = Date.now();

    const job = await prisma.job.findUnique({
      where: { id: request.jobId },
      include: { client: true, completion: true, documents: true },
    });
    if (!job) {
      return { syncRunId: null, status: 'FAILED', skipped: false, message: 'Job not found.' };
    }

    // --- Idempotency (webhook/polling only; manual & retry are operator-driven) ---
    const idempotencyKey =
      request.idempotencyKey ??
      buildIdempotencyKey({
        sourceEventId: request.sourceEventId,
        joblogicJobId: job.joblogicJobId,
        eventType: request.eventType ?? 'job.completed',
        completionVersion: request.completionVersion ?? job.completion?.updatedAt.getTime().toString(),
      });

    const guardTriggers: TriggerType[] = [TriggerTypeEnum.WEBHOOK, TriggerTypeEnum.POLLING];
    if (guardTriggers.includes(request.triggerType) && (await isAlreadyProcessed(idempotencyKey))) {
      return {
        syncRunId: null,
        status: 'IGNORED',
        skipped: true,
        message: `Duplicate completion event ignored (idempotency key already processed).`,
      };
    }

    const priorAttempts = await prisma.syncRun.count({ where: { jobId: job.id } });
    const run = await prisma.syncRun.create({
      data: {
        jobId: job.id,
        direction: 'JOBLOGIC_TO_CONCERTO',
        triggerType: request.triggerType,
        status: SyncRunStatus.QUEUED,
        startedAt: new Date(),
        attemptNumber: priorAttempts + 1,
        idempotencyKey,
        sourcePayload: JSON.stringify({
          joblogicJobId: job.joblogicJobId,
          concertoJobReference: job.concertoJobReference,
          completion: job.completion ? summariseCompletion(job.completion) : null,
        }),
      },
    });
    const audit = new SyncAuditLog(run.id);

    await prisma.job.update({ where: { id: job.id }, data: { syncStatus: SyncStatus.SYNCING } });

    try {
      // ---- 1. VALIDATE ------------------------------------------------------
      await this.setStage(run.id, SyncRunStatus.VALIDATING);
      await audit.record(SyncRunStatus.VALIDATING, EventLevel.INFO, `Completion event received from Joblogic (${request.triggerType.toLowerCase()})`);
      await sleep(STAGE_DELAY_MS);
      await audit.record(SyncRunStatus.VALIDATING, EventLevel.INFO, `Joblogic job ${job.joblogicJobId} loaded`);

      if (job.joblogicStatus !== 'Complete') {
        throw new ValidationBlock('Joblogic job is not marked Complete; sync skipped by rule.');
      }
      if (!job.completion) {
        throw new MissingCompletionError();
      }
      if (!job.concertoJobReference) {
        throw new MissingReferenceError();
      }
      if (!isValidConcertoReference(job.concertoJobReference)) {
        throw new MissingReferenceError(
          `Concerto reference "${job.concertoJobReference}" is not in the expected format.`,
        );
      }
      await audit.record(SyncRunStatus.VALIDATING, EventLevel.SUCCESS, `Concerto reference ${job.concertoJobReference} validated`);

      // ---- 2. MATCH ---------------------------------------------------------
      await this.setStage(run.id, SyncRunStatus.MATCHING);
      await sleep(STAGE_DELAY_MS);
      const matches = await this.concerto.findJobByReference(job.concertoJobReference);
      if (matches.length === 0) throw new TargetNotFoundError(job.concertoJobReference);
      if (matches.length > 1) throw new DuplicateTargetError(job.concertoJobReference, matches.length);
      const target = matches[0]!;
      await audit.record(SyncRunStatus.MATCHING, EventLevel.SUCCESS, `Target Concerto record located (${job.concertoJobReference})`);

      // ---- 3. TRANSFORM -----------------------------------------------------
      await this.setStage(run.id, SyncRunStatus.TRANSFORMING);
      await sleep(STAGE_DELAY_MS);
      const mappings = await prisma.fieldMapping.findMany({
        where: {
          organisationId: job.organisationId,
          active: true,
          OR: [{ clientId: job.clientId }, { clientId: null }],
        },
        orderBy: { sortOrder: 'asc' },
      });
      const changes = resolvePlannedChanges({
        mappings,
        completion: toSourceCompletion(job.completion),
        policy: job.client,
        targetFields: target.fields,
        extra: { engineerName: job.engineerName, siteName: job.siteName },
      });

      const needsReview = changes.filter((c) => c.status === 'NEEDS_REVIEW');
      if (needsReview.length > 0) {
        throw new PayloadValidationError(needsReview.map((c) => `${c.sourceField}: ${c.error}`));
      }

      const payload = buildUpdatePayload(changes);
      const willUpdate = changes.filter((c) => c.status === 'WILL_UPDATE');
      const excluded = changes.filter((c) => c.status === 'EXCLUDED_BY_RULE');
      await prisma.syncRun.update({
        where: { id: run.id },
        data: { transformedPayload: JSON.stringify(payload) },
      });
      await audit.record(
        SyncRunStatus.TRANSFORMING,
        EventLevel.SUCCESS,
        `${willUpdate.length} field change${willUpdate.length === 1 ? '' : 's'} identified` +
          (excluded.length ? ` (${excluded.length} excluded by client rule)` : ''),
        { willUpdate: willUpdate.map((c) => c.targetField), excluded: excluded.map((c) => c.targetField) },
      );

      // ---- 4. UPDATE --------------------------------------------------------
      await this.setStage(run.id, SyncRunStatus.UPDATING);
      await sleep(STAGE_DELAY_MS);
      let fieldsUpdated = 0;
      if (Object.keys(payload).length > 0) {
        const updateResult = await this.concerto.updateJob(job.concertoJobReference, payload);
        fieldsUpdated = updateResult.updatedFields.length;
        await prisma.syncRun.update({
          where: { id: run.id },
          data: { targetResponse: JSON.stringify(updateResult.targetResponse) },
        });
        for (const c of willUpdate) {
          await audit.record(
            SyncRunStatus.UPDATING,
            EventLevel.SUCCESS,
            `${humanField(c.targetField)} updated: ${c.targetPreview}`,
          );
        }
      } else {
        await audit.record(SyncRunStatus.UPDATING, EventLevel.INFO, 'No field changes required — Concerto already up to date');
      }

      // ---- 5. UPLOAD DOCUMENTS ---------------------------------------------
      await this.setStage(run.id, SyncRunStatus.UPLOADING_DOCUMENTS);
      const docOutcome = await this.transferDocuments(job.id, job.concertoJobReference, job.client.syncDocuments, audit);

      // ---- 6. STATUS (rule-gated) ------------------------------------------
      if (job.client.syncStatus && !job.client.requireApprovalBeforeClose) {
        await this.concerto.updateJobStatus(job.concertoJobReference, 'Completed');
        await audit.record(SyncRunStatus.UPDATING, EventLevel.SUCCESS, 'Concerto job status set to Completed');
      } else if (job.client.requireApprovalBeforeClose) {
        await audit.record(SyncRunStatus.UPDATING, EventLevel.INFO, 'Concerto job left open — manual approval required before close (client rule)');
      }

      // ---- 7. VERIFY --------------------------------------------------------
      await this.setStage(run.id, SyncRunStatus.VERIFYING);
      await sleep(STAGE_DELAY_MS);
      const verification = await this.concerto.verifyUpdate(job.concertoJobReference, payload);
      if (!verification.verified) {
        await audit.record(
          SyncRunStatus.VERIFYING,
          EventLevel.WARNING,
          `Verification found ${verification.mismatches.length} mismatch(es)`,
          { mismatches: verification.mismatches },
        );
      } else {
        await audit.record(SyncRunStatus.VERIFYING, EventLevel.SUCCESS, 'Concerto record verified — target matches expected values');
      }

      // ---- OUTCOME ----------------------------------------------------------
      const durationMs = Date.now() - startedAt;
      const partial = docOutcome.failed > 0 || !verification.verified;
      const finalRunStatus = partial ? SyncRunStatus.PARTIAL : SyncRunStatus.SUCCESS;
      const finalJobStatus = partial ? SyncStatus.PARTIAL : SyncStatus.SYNCED;

      await audit.record(
        partial ? SyncRunStatus.PARTIAL : SyncRunStatus.SUCCESS,
        partial ? EventLevel.WARNING : EventLevel.SUCCESS,
        partial
          ? `Sync partially complete — ${fieldsUpdated} field(s) updated, ${docOutcome.failed} document(s) failed`
          : `Sync completed successfully in ${(durationMs / 1000).toFixed(1)}s`,
      );

      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: finalRunStatus,
          completedAt: new Date(),
          durationMs,
          fieldsUpdated,
          documentsTransferred: docOutcome.transferred,
        },
      });
      await prisma.job.update({
        where: { id: job.id },
        data: {
          syncStatus: finalJobStatus,
          lastSyncAt: new Date(),
          concertoStatus: job.client.requireApprovalBeforeClose ? job.concertoStatus : 'Completed',
        },
      });
      await this.touchConnectionSuccess(job.organisationId);
      await markProcessed({
        idempotencyKey,
        sourceEventId: request.sourceEventId,
        joblogicJobId: job.joblogicJobId,
        eventType: request.eventType ?? 'job.completed',
        syncRunId: run.id,
      });

      return {
        syncRunId: run.id,
        status: finalRunStatus,
        skipped: false,
        message: partial ? 'Sync partially completed.' : 'Sync completed successfully.',
      };
    } catch (error) {
      return this.handleFailure(error, run.id, job.id, audit, startedAt);
    }
  }

  // --- helpers ---------------------------------------------------------------

  private async setStage(runId: string, stage: SyncRunStatus): Promise<void> {
    await prisma.syncRun.update({ where: { id: runId }, data: { status: stage } });
  }

  private async transferDocuments(
    jobId: string,
    reference: string,
    policyAllowsDocuments: boolean,
    audit: SyncAuditLog,
  ): Promise<{ transferred: number; failed: number; skipped: number }> {
    const documents = await prisma.document.findMany({ where: { jobId } });
    let transferred = 0;
    let failed = 0;
    let skipped = 0;

    for (const doc of documents) {
      // Business rule: only transfer permitted categories, allowed types/sizes.
      const permittedCategory = ['CERTIFICATE', 'SERVICE_REPORT', 'COMPLETION_SHEET', 'COMPLIANCE_DOCUMENT'].includes(
        doc.documentType,
      );
      if (!policyAllowsDocuments || !permittedCategory || !isAllowedDocument(doc.mimeType, doc.sizeBytes)) {
        skipped += 1;
        await prisma.document.update({ where: { id: doc.id }, data: { transferStatus: DocumentTransferStatus.SKIPPED } });
        await audit.record(SyncRunStatus.UPLOADING_DOCUMENTS, EventLevel.INFO, `Document skipped by rule: ${doc.filename}`);
        continue;
      }

      await prisma.document.update({ where: { id: doc.id }, data: { transferStatus: DocumentTransferStatus.TRANSFERRING } });
      try {
        const downloaded = await this.joblogic.downloadDocument(doc.id);
        const uploaded = await this.concerto.uploadDocument(reference, downloaded);
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            transferStatus: DocumentTransferStatus.TRANSFERRED,
            transferredAt: new Date(),
            storageReference: uploaded.concertoDocumentId,
          },
        });
        transferred += 1;
        await audit.record(SyncRunStatus.UPLOADING_DOCUMENTS, EventLevel.SUCCESS, `Certificate uploaded: ${doc.filename}`);
      } catch (err) {
        failed += 1;
        await prisma.document.update({ where: { id: doc.id }, data: { transferStatus: DocumentTransferStatus.FAILED } });
        const filename = err instanceof DocumentTransferError ? err.filename : doc.filename;
        await audit.record(
          SyncRunStatus.UPLOADING_DOCUMENTS,
          EventLevel.ERROR,
          `Document upload failed: ${filename} — ${toSafeMessage(err)}`,
        );
      }
    }
    return { transferred, failed, skipped };
  }

  private async handleFailure(
    error: unknown,
    runId: string,
    jobId: string,
    audit: SyncAuditLog,
    startedAt: number,
  ): Promise<SyncDispatchResult> {
    const retryable = isRetryableError(error);
    const runStatus = error instanceof IntegrationError && !retryable ? SyncRunStatus.EXCEPTION : SyncRunStatus.FAILED;
    const jobStatus = retryable ? SyncStatus.FAILED : SyncStatus.EXCEPTION;

    await audit.record(runStatus, EventLevel.ERROR, toSafeMessage(error), { code: toErrorCode(error) });

    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        status: runStatus,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        errorCode: toErrorCode(error),
        errorMessage: toSafeMessage(error),
      },
    });

    const exception = await prisma.exception.create({
      data: {
        jobId,
        syncRunId: runId,
        type: toExceptionType(error),
        severity: toExceptionSeverity(error),
        title: exceptionTitle(error),
        description: toSafeMessage(error),
        status: ExceptionStatus.OPEN,
      },
    });

    await prisma.job.update({ where: { id: jobId }, data: { syncStatus: jobStatus } });

    return {
      syncRunId: runId,
      status: runStatus,
      skipped: false,
      message: `Sync raised an exception: ${exception.title}`,
    };
  }

  private async touchConnectionSuccess(organisationId: string): Promise<void> {
    await prisma.integrationConnection.updateMany({
      where: { organisationId, provider: 'CONCERTO' },
      data: { lastSuccessfulSyncAt: new Date() },
    });
  }
}

// --- local, non-integration error types (validation blocks) ------------------

class ValidationBlock extends IntegrationError {
  readonly code = 'VALIDATION';
  readonly exceptionType = 'VALIDATION_ERROR' as const;
  readonly severity = 'LOW' as const;
  readonly retryable = false;
  constructor(message: string) {
    super(message);
  }
}
class MissingCompletionError extends IntegrationError {
  readonly code = 'REQUIRED_FIELD_MISSING';
  readonly exceptionType = 'REQUIRED_FIELD_MISSING' as const;
  readonly severity = 'MEDIUM' as const;
  readonly retryable = false;
  constructor() {
    super('No completion record found for this Joblogic job.');
  }
}
class PayloadValidationError extends IntegrationError {
  readonly code = 'VALIDATION';
  readonly exceptionType = 'VALIDATION_ERROR' as const;
  readonly severity = 'MEDIUM' as const;
  readonly retryable = false;
  constructor(issues: string[]) {
    super(`Target payload failed validation: ${issues.join('; ')}`);
  }
}

function exceptionTitle(error: unknown): string {
  if (error instanceof MissingReferenceError) return 'Missing Concerto reference';
  if (error instanceof TargetNotFoundError) return 'Target Concerto job not found';
  if (error instanceof DuplicateTargetError) return 'Multiple Concerto jobs matched';
  if (error instanceof DocumentTransferError) return 'Certificate upload failed';
  if (error instanceof IntegrationError) return error.message.slice(0, 80);
  return 'Unexpected sync error';
}

function toSourceCompletion(c: {
  arrivalTime: Date | null;
  departureTime: Date | null;
  timeOnSiteMinutes: number | null;
  workCompleted: string | null;
  engineerNotes: string | null;
  labourCost: number | null;
  materialsCost: number | null;
  totalCost: number | null;
  followOnWorkRequired: boolean;
  followOnWorkNotes: string | null;
  completedAt: Date | null;
}): SourceCompletion {
  return {
    arrivalTime: iso(c.arrivalTime),
    departureTime: iso(c.departureTime),
    timeOnSiteMinutes: c.timeOnSiteMinutes,
    workCompleted: c.workCompleted,
    engineerNotes: c.engineerNotes,
    labourCost: c.labourCost,
    materialsCost: c.materialsCost,
    totalCost: c.totalCost,
    followOnWorkRequired: c.followOnWorkRequired,
    followOnWorkNotes: c.followOnWorkNotes,
    completedAt: iso(c.completedAt),
  };
}

function summariseCompletion(c: { workCompleted: string | null; timeOnSiteMinutes: number | null; totalCost: number | null }) {
  return { workCompleted: c.workCompleted, timeOnSiteMinutes: c.timeOnSiteMinutes, totalCost: c.totalCost };
}

const FIELD_LABELS: Record<string, string> = {
  contractorCompletionNotes: 'Completion notes',
  workCompletionDescription: 'Work completed',
  actualLabourDuration: 'Time on site',
  actualCompletionDate: 'Completion date',
  contractorCost: 'Contractor cost',
  followOnRequired: 'Follow-on work',
};
function humanField(targetField: string): string {
  return FIELD_LABELS[targetField] ?? targetField;
}
