import { prisma } from '@/lib/db/prisma';
import { getJoblogicCredentials } from '@/lib/config';
import { verifyHmacSignature } from '@/lib/integrations/webhook-signature';
import { makePlaceholderPdf } from '@/lib/integrations/mock-pdf';
import { DocumentType } from '@/lib/domain/enums';
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
const toIso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Mock Joblogic connector.
 *
 * In mock mode the application database's Job / JobCompletion / Document tables
 * represent the Joblogic source-of-truth. This connector reads them and returns
 * normalised shapes exactly as a live connector would, so the sync engine is
 * identical in both modes.
 */
export class MockJoblogicConnector implements JoblogicConnector {
  readonly provider = 'JOBLOGIC' as const;
  readonly mode = 'mock' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    const count = await prisma.job.count();
    return {
      ok: true,
      provider: 'JOBLOGIC',
      mode: 'mock',
      message: `Mock Joblogic reachable — ${count} jobs available.`,
      latencyMs: Date.now() - start,
      checkedAt: nowIso(),
    };
  }

  async getJob(joblogicJobId: string): Promise<NormalisedJob | null> {
    const job = await prisma.job.findFirst({ where: { joblogicJobId } });
    if (!job) return null;
    return {
      joblogicJobId: job.joblogicJobId,
      concertoJobReference: job.concertoJobReference,
      siteName: job.siteName,
      siteAddress: job.siteAddress,
      assetReference: job.assetReference,
      jobDescription: job.jobDescription,
      engineerName: job.engineerName,
      joblogicStatus: job.joblogicStatus,
      scheduledDate: toIso(job.scheduledDate),
      completedAt: toIso(job.completedAt),
    };
  }

  async getCompletedJobs(since: Date): Promise<NormalisedJob[]> {
    const jobs = await prisma.job.findMany({
      where: { joblogicStatus: 'Complete', completedAt: { gte: since } },
    });
    return jobs.map((job) => ({
      joblogicJobId: job.joblogicJobId,
      concertoJobReference: job.concertoJobReference,
      siteName: job.siteName,
      siteAddress: job.siteAddress,
      assetReference: job.assetReference,
      jobDescription: job.jobDescription,
      engineerName: job.engineerName,
      joblogicStatus: job.joblogicStatus,
      scheduledDate: toIso(job.scheduledDate),
      completedAt: toIso(job.completedAt),
    }));
  }

  async getJobCompletion(joblogicJobId: string): Promise<NormalisedCompletion | null> {
    const job = await prisma.job.findFirst({
      where: { joblogicJobId },
      include: { completion: true },
    });
    if (!job?.completion) return null;
    const c = job.completion;
    return this.normaliseCompletion({
      joblogicJobId,
      arrivalTime: toIso(c.arrivalTime),
      departureTime: toIso(c.departureTime),
      timeOnSiteMinutes: c.timeOnSiteMinutes,
      workCompleted: c.workCompleted,
      engineerNotes: c.engineerNotes,
      labourCost: c.labourCost,
      materialsCost: c.materialsCost,
      totalCost: c.totalCost,
      followOnWorkRequired: c.followOnWorkRequired,
      followOnWorkNotes: c.followOnWorkNotes,
      completedAt: toIso(c.completedAt),
      completionVersion: c.updatedAt.getTime().toString(),
    });
  }

  async getJobDocuments(joblogicJobId: string): Promise<NormalisedDocument[]> {
    const job = await prisma.job.findFirst({
      where: { joblogicJobId },
      include: { documents: true },
    });
    if (!job) return [];
    return job.documents.map((d) => ({
      sourceDocumentId: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      documentType: (d.documentType as DocumentType) ?? DocumentType.OTHER,
      sizeBytes: d.sizeBytes,
      sourceUrl: d.sourceUrl,
    }));
  }

  async downloadDocument(sourceDocumentId: string): Promise<DownloadedDocument> {
    const doc = await prisma.document.findUnique({ where: { id: sourceDocumentId } });
    const filename = doc?.filename ?? 'document.pdf';
    const content = makePlaceholderPdf(filename);
    return {
      sourceDocumentId,
      filename,
      mimeType: doc?.mimeType ?? 'application/pdf',
      sizeBytes: doc?.sizeBytes ?? content.length,
      content,
    };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    const secret = input.secret || getJoblogicCredentials().webhookSecret;
    return verifyHmacSignature({ rawBody: input.rawBody, signature: input.signature, secret });
  }

  normaliseJob(rawJob: Record<string, unknown>): NormalisedJob {
    const s = (k: string) => (typeof rawJob[k] === 'string' ? (rawJob[k] as string) : null);
    return {
      joblogicJobId: String(rawJob.joblogicJobId ?? rawJob.id ?? ''),
      concertoJobReference: s('concertoJobReference'),
      siteName: s('siteName') ?? '',
      siteAddress: s('siteAddress') ?? '',
      assetReference: s('assetReference'),
      jobDescription: s('jobDescription') ?? '',
      engineerName: s('engineerName'),
      joblogicStatus: s('joblogicStatus') ?? 'Complete',
      scheduledDate: s('scheduledDate'),
      completedAt: s('completedAt'),
    };
  }

  normaliseCompletion(raw: Record<string, unknown>): NormalisedCompletion {
    const num = (k: string) => (typeof raw[k] === 'number' ? (raw[k] as number) : null);
    const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : null);
    return {
      joblogicJobId: String(raw.joblogicJobId ?? ''),
      arrivalTime: str('arrivalTime'),
      departureTime: str('departureTime'),
      timeOnSiteMinutes: num('timeOnSiteMinutes'),
      workCompleted: str('workCompleted'),
      engineerNotes: str('engineerNotes'),
      labourCost: num('labourCost'),
      materialsCost: num('materialsCost'),
      totalCost: num('totalCost'),
      followOnWorkRequired: raw.followOnWorkRequired === true,
      followOnWorkNotes: str('followOnWorkNotes'),
      completedAt: str('completedAt'),
      completionVersion: str('completionVersion'),
      raw,
    };
  }
}
