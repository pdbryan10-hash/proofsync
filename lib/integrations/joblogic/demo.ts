import { prisma } from '@/lib/db/prisma';
import { getJoblogicCredentials } from '@/lib/config';
import { verifyHmacSignature } from '@/lib/integrations/webhook-signature';
import { makePlaceholderPdf } from '@/lib/integrations/mock-pdf';
import { DocumentType } from '@/lib/domain/enums';
import { TargetNotFoundError } from '@/lib/errors/integration-errors';
import { sourceJobs } from '@/lib/demo/mongo';
import { withSession } from '@/lib/demo/session';
import { SOURCE_CATEGORY_TO_DOCUMENT_TYPE, type SourceJobDoc } from '@/lib/demo/schema';
import type { IntakeJob, IntakeAssignment } from '@/lib/demo/intake';
import type {
  JoblogicConnector,
  NormalisedJob,
  NormalisedCompletion,
  NormalisedDocument,
  DownloadedDocument,
  ConnectionTestResult,
  WebhookVerificationInput,
} from '@/lib/integrations/types';

const nowIso = () => new Date().toISOString();
const toIso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/**
 * Demo Joblogic connector — reads the SOURCE system's own database (DB1) over a
 * simulated user session.
 *
 * This is where Joblogic's dialect stops. Its documents nest a `visit` and a
 * `completionSheet`, call the person an `engineer` and money a `charge`; nothing
 * above this class knows any of that. Everything leaves here as the normalised
 * shapes in lib/integrations/types.ts, exactly as the live connector will emit.
 *
 * See lib/demo/session.ts for what the "session" does and does not prove.
 */
export class DemoJoblogicConnector implements JoblogicConnector {
  readonly provider = 'JOBLOGIC' as const;
  readonly mode = 'demo' as const;

  /**
   * INTAKE seam — create a job in the field system from a client-raised work
   * order, dispatched to an engineer, with the client's reference preserved as the
   * match key. Idempotent: a job with this number already existing is a no-op, so
   * re-running intake never double-creates.
   */
  async createJob(
    job: IntakeJob,
    jobNumber: string,
    engineer: IntakeAssignment,
  ): Promise<{ created: boolean; jobNumber: string }> {
    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const existing = await jobs.findOne({ jobNumber });
      if (existing) return { created: false, jobNumber };

      const now = new Date();
      const doc: SourceJobDoc = {
        jobNumber,
        customerOrderRef: job.reference,
        siteName: job.siteName,
        siteAddress: job.siteAddress,
        assetRef: job.assetRef,
        description: job.summary,
        engineer,
        status: 'Allocated',
        scheduledDate: now,
        completedAt: null,
        visit: null,
        completionSheet: null,
        charges: null,
        attachments: [],
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      await jobs.insertOne(doc);
      return { created: true, jobNumber };
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    return withSession('JOBLOGIC', async (session) => {
      const jobs = await sourceJobs();
      const count = await jobs.countDocuments({});
      return {
        ok: true,
        provider: 'JOBLOGIC' as const,
        mode: 'demo' as const,
        message: `Signed in to Joblogic as ${session.username} — ${count} jobs visible.`,
        latencyMs: Date.now() - start,
        checkedAt: nowIso(),
      };
    });
  }

  async getJob(joblogicJobId: string): Promise<NormalisedJob | null> {
    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const doc = await jobs.findOne({ jobNumber: joblogicJobId });
      return doc ? toNormalisedJob(doc) : null;
    });
  }

  async getCompletedJobs(since: Date): Promise<NormalisedJob[]> {
    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const docs = await jobs
        .find({ status: 'Complete', completedAt: { $gte: since } })
        // Newest completions first, so a just-finished job (e.g. a closed-loop
        // intake job) syncs ahead of an older backlog rather than behind it.
        .sort({ completedAt: -1 })
        .toArray();
      return docs.map(toNormalisedJob);
    });
  }

  async getJobCompletion(joblogicJobId: string): Promise<NormalisedCompletion | null> {
    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const doc = await jobs.findOne({ jobNumber: joblogicJobId });
      if (!doc || !doc.completionSheet) return null;
      return toNormalisedCompletion(doc);
    });
  }

  async getJobDocuments(joblogicJobId: string): Promise<NormalisedDocument[]> {
    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const doc = await jobs.findOne({ jobNumber: joblogicJobId });
      if (!doc) return [];
      return doc.attachments.map((a) => ({
        sourceDocumentId: a.attachmentId,
        filename: a.fileName,
        mimeType: a.contentType,
        documentType:
          (SOURCE_CATEGORY_TO_DOCUMENT_TYPE[a.category] as DocumentType) ?? DocumentType.OTHER,
        sizeBytes: a.bytes,
        sourceUrl: null,
      }));
    });
  }

  /**
   * The engine passes ProofSync's OWN document row id (see
   * JobCompletionSyncService.transferDocuments), not Joblogic's. Resolve our
   * record first to recover the foreign attachment id, then fetch from DB1 —
   * which is exactly the indirection a live connector needs.
   */
  async downloadDocument(sourceDocumentId: string): Promise<DownloadedDocument> {
    const ours = await prisma.document.findUnique({ where: { id: sourceDocumentId } });
    const foreignId = ours?.sourceDocumentId ?? sourceDocumentId;

    return withSession('JOBLOGIC', async () => {
      const jobs = await sourceJobs();
      const doc = await jobs.findOne({ 'attachments.attachmentId': foreignId });
      const attachment = doc?.attachments.find((a) => a.attachmentId === foreignId);
      if (!attachment) {
        throw new TargetNotFoundError(`Joblogic attachment ${foreignId}`);
      }
      // The bytes are synthesised: the demo proves the transfer path, not PDF
      // fidelity. A live connector streams the real file here.
      const content = makePlaceholderPdf(attachment.fileName);
      return {
        sourceDocumentId,
        filename: attachment.fileName,
        mimeType: attachment.contentType,
        sizeBytes: attachment.bytes ?? content.length,
        content,
      };
    });
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    const secret = input.secret || getJoblogicCredentials().webhookSecret;
    return verifyHmacSignature({ rawBody: input.rawBody, signature: input.signature, secret });
  }

  normaliseJob(rawJob: Record<string, unknown>): NormalisedJob {
    return toNormalisedJob(rawJob as unknown as SourceJobDoc);
  }

  normaliseCompletion(rawCompletion: Record<string, unknown>): NormalisedCompletion {
    return toNormalisedCompletion(rawCompletion as unknown as SourceJobDoc);
  }
}

// --- Joblogic dialect → normalised ------------------------------------------

function toNormalisedJob(doc: SourceJobDoc): NormalisedJob {
  return {
    joblogicJobId: doc.jobNumber,
    // Hand-typed on site, so it may be absent or malformed. Passed through
    // verbatim — validating it is the engine's job, and refusing to guess at it
    // is the whole point.
    concertoJobReference: doc.customerOrderRef,
    siteName: doc.siteName,
    siteAddress: doc.siteAddress,
    assetReference: doc.assetRef,
    jobDescription: doc.description,
    engineerName: doc.engineer?.engineerName ?? null,
    joblogicStatus: doc.status,
    scheduledDate: toIso(doc.scheduledDate),
    completedAt: toIso(doc.completedAt),
  };
}

function toNormalisedCompletion(doc: SourceJobDoc): NormalisedCompletion {
  const sheet = doc.completionSheet;
  const visit = doc.visit;
  const charges = doc.charges;

  return {
    joblogicJobId: doc.jobNumber,
    arrivalTime: toIso(visit?.arrivedAt),
    departureTime: toIso(visit?.departedAt),
    timeOnSiteMinutes: visit?.minutesOnSite ?? null,
    workCompleted: sheet?.workCarriedOut ?? null,
    engineerNotes: sheet?.engineerComments ?? null,
    labourCost: charges?.labourCharge ?? null,
    materialsCost: charges?.materialsCharge ?? null,
    totalCost: charges?.totalCharge ?? null,
    followOnWorkRequired: sheet?.followOnRequired === true,
    followOnWorkNotes: sheet?.followOnDetail ?? null,
    completedAt: toIso(doc.completedAt),
    // Joblogic bumps `revision` on every edit to the sheet, so the same
    // completion re-polled yields the same key and is ignored, while a genuine
    // re-visit produces a new one and syncs again.
    completionVersion: String(doc.revision ?? 1),
    raw: doc as unknown as Record<string, unknown>,
  };
}
