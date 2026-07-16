import type { DocumentType } from '@/lib/domain/enums';

/**
 * Provider-agnostic, normalised shapes exchanged between connectors and the
 * sync engine. Connectors are the ONLY place that knows about provider-specific
 * request/response formats; everything above this line speaks these types.
 */

export interface NormalisedJob {
  joblogicJobId: string;
  concertoJobReference: string | null;
  siteName: string;
  siteAddress: string;
  assetReference: string | null;
  jobDescription: string;
  engineerName: string | null;
  joblogicStatus: string;
  scheduledDate: string | null; // ISO
  completedAt: string | null; // ISO
}

export interface NormalisedCompletion {
  joblogicJobId: string;
  arrivalTime: string | null; // ISO
  departureTime: string | null; // ISO
  timeOnSiteMinutes: number | null;
  workCompleted: string | null;
  engineerNotes: string | null;
  labourCost: number | null;
  materialsCost: number | null;
  totalCost: number | null;
  followOnWorkRequired: boolean;
  followOnWorkNotes: string | null;
  completedAt: string | null; // ISO
  /** Completion version / revision, used for idempotency. */
  completionVersion: string | null;
  /** Raw provider payload for audit traceability. */
  raw: Record<string, unknown>;
}

export interface NormalisedDocument {
  sourceDocumentId: string;
  filename: string;
  mimeType: string;
  documentType: DocumentType;
  sizeBytes: number | null;
  sourceUrl: string | null;
}

export interface DownloadedDocument {
  sourceDocumentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** In mock mode this is a small placeholder buffer; in live mode the real bytes. */
  content: Buffer;
}

export interface ConnectionTestResult {
  ok: boolean;
  provider: 'JOBLOGIC' | 'CONCERTO';
  mode: 'mock' | 'demo' | 'live';
  message: string;
  latencyMs: number;
  checkedAt: string; // ISO
}

/** The subset of a Concerto job the connector can read/verify. */
export interface ConcertoTargetJob {
  concertoJobReference: string;
  status: string;
  fields: Record<string, unknown>;
}

export interface ConcertoUpdateResult {
  concertoJobReference: string;
  updatedFields: string[];
  status: string;
  targetResponse: Record<string, unknown>;
}

export interface ConcertoDocumentUploadResult {
  sourceDocumentId: string;
  concertoDocumentId: string;
  filename: string;
}

export interface VerificationResult {
  verified: boolean;
  mismatches: Array<{ field: string; expected: unknown; actual: unknown }>;
}

// --- Connector interfaces (§8) ----------------------------------------------

export interface WebhookVerificationInput {
  rawBody: string;
  signature: string | null;
  secret: string;
}

export interface JoblogicConnector {
  readonly provider: 'JOBLOGIC';
  readonly mode: 'mock' | 'demo' | 'live';
  testConnection(): Promise<ConnectionTestResult>;
  getJob(joblogicJobId: string): Promise<NormalisedJob | null>;
  getCompletedJobs(since: Date): Promise<NormalisedJob[]>;
  getJobCompletion(joblogicJobId: string): Promise<NormalisedCompletion | null>;
  getJobDocuments(joblogicJobId: string): Promise<NormalisedDocument[]>;
  downloadDocument(sourceDocumentId: string): Promise<DownloadedDocument>;
  verifyWebhookSignature(input: WebhookVerificationInput): boolean;
  normaliseJob(rawJob: Record<string, unknown>): NormalisedJob;
  normaliseCompletion(rawCompletion: Record<string, unknown>): NormalisedCompletion;
}

export interface ConcertoConnector {
  readonly provider: 'CONCERTO';
  readonly mode: 'mock' | 'demo' | 'live';
  testConnection(): Promise<ConnectionTestResult>;
  /** Returns all jobs matching a reference. 0 → not found, >1 → ambiguous. */
  findJobByReference(concertoJobReference: string): Promise<ConcertoTargetJob[]>;
  getJob(concertoJobReference: string): Promise<ConcertoTargetJob | null>;
  updateJob(
    concertoJobReference: string,
    payload: Record<string, unknown>,
  ): Promise<ConcertoUpdateResult>;
  uploadDocument(
    concertoJobReference: string,
    document: DownloadedDocument,
  ): Promise<ConcertoDocumentUploadResult>;
  updateJobStatus(concertoJobReference: string, status: string): Promise<void>;
  verifyUpdate(
    concertoJobReference: string,
    expectedValues: Record<string, unknown>,
  ): Promise<VerificationResult>;
}
