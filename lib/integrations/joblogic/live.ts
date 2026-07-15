import { getJoblogicCredentials } from '@/lib/config';
import { verifyHmacSignature } from '@/lib/integrations/webhook-signature';
import {
  IntegrationAuthenticationError,
  IntegrationTimeoutError,
} from '@/lib/errors/integration-errors';
import type {
  JoblogicConnector,
  NormalisedJob,
  NormalisedCompletion,
  NormalisedDocument,
  DownloadedDocument,
  ConnectionTestResult,
  WebhookVerificationInput,
} from '@/lib/integrations/types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * LIVE Joblogic connector — production scaffold.
 *
 * ⚠️  DO NOT INVENT ENDPOINTS. Every `TODO(joblogic)` below marks a value that
 *     must be supplied from SEE's Joblogic account and confirmed against the
 *     official Joblogic API documentation (see docs/integration-checklist.md).
 *
 * The shape of each method mirrors MockJoblogicConnector so switching
 * INTEGRATION_MODE=live changes behaviour without touching the sync engine.
 */
export class LiveJoblogicConnector implements JoblogicConnector {
  readonly provider = 'JOBLOGIC' as const;
  readonly mode = 'live' as const;

  private readonly creds = getJoblogicCredentials();

  private assertConfigured(): void {
    if (!this.creds.baseUrl || !this.creds.apiKey) {
      throw new IntegrationAuthenticationError(
        'Joblogic live credentials are not configured. Set JOBLOGIC_API_BASE_URL and JOBLOGIC_API_KEY.',
      );
    }
  }

  /** Shared authenticated fetch with timeout handling. */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.creds.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          // TODO(joblogic): confirm the authentication scheme (Bearer? ApiKey header?
          //   OAuth2 client-credentials?) and tenant header name.
          Authorization: `Bearer ${this.creds.apiKey}`,
          'X-Tenant-Id': this.creds.tenantId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (res.status === 401 || res.status === 403) {
        throw new IntegrationAuthenticationError();
      }
      if (!res.ok) {
        throw new Error(`Joblogic request failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new IntegrationTimeoutError('Joblogic request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    // TODO(joblogic): replace with a real lightweight health/whoami endpoint.
    await this.request('/__TODO_healthcheck__');
    return {
      ok: true,
      provider: 'JOBLOGIC',
      mode: 'live',
      message: 'Joblogic API reachable.',
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }

  async getJob(joblogicJobId: string): Promise<NormalisedJob | null> {
    // TODO(joblogic): real path e.g. `/v1/jobs/{id}`.
    const raw = await this.request<Record<string, unknown>>(
      `/__TODO_jobs__/${encodeURIComponent(joblogicJobId)}`,
    );
    return this.normaliseJob(raw);
  }

  async getCompletedJobs(since: Date): Promise<NormalisedJob[]> {
    // TODO(joblogic): real path + query for completed jobs since a timestamp.
    const raw = await this.request<{ items: Record<string, unknown>[] }>(
      `/__TODO_jobs__?status=complete&since=${since.toISOString()}`,
    );
    return (raw.items ?? []).map((r) => this.normaliseJob(r));
  }

  async getJobCompletion(joblogicJobId: string): Promise<NormalisedCompletion | null> {
    // TODO(joblogic): real completion endpoint + field names.
    const raw = await this.request<Record<string, unknown>>(
      `/__TODO_jobs__/${encodeURIComponent(joblogicJobId)}/completion`,
    );
    return this.normaliseCompletion(raw);
  }

  async getJobDocuments(joblogicJobId: string): Promise<NormalisedDocument[]> {
    // TODO(joblogic): real documents endpoint.
    const raw = await this.request<{ documents: Record<string, unknown>[] }>(
      `/__TODO_jobs__/${encodeURIComponent(joblogicJobId)}/documents`,
    );
    // TODO(joblogic): map provider document type → DocumentType enum.
    return (raw.documents ?? []).map((d) => ({
      sourceDocumentId: String(d.id ?? ''),
      filename: String(d.filename ?? 'document'),
      mimeType: String(d.mimeType ?? 'application/octet-stream'),
      documentType: 'OTHER',
      sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : null,
      sourceUrl: typeof d.url === 'string' ? d.url : null,
    }));
  }

  async downloadDocument(sourceDocumentId: string): Promise<DownloadedDocument> {
    // TODO(joblogic): real binary download endpoint; stream to a buffer.
    void sourceDocumentId;
    throw new Error('LiveJoblogicConnector.downloadDocument not yet configured (TODO joblogic).');
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    // TODO(joblogic): confirm signature header + scheme; verifyHmacSignature is
    //   the common sha256=<hex> convention and can be swapped here.
    const secret = input.secret || this.creds.webhookSecret;
    return verifyHmacSignature({ rawBody: input.rawBody, signature: input.signature, secret });
  }

  normaliseJob(raw: Record<string, unknown>): NormalisedJob {
    // TODO(joblogic): map real field names. CRITICAL: confirm which Joblogic
    //   field holds the Concerto reference (custom field? PO reference?).
    const s = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : null);
    return {
      joblogicJobId: String(raw.id ?? raw.jobId ?? ''),
      concertoJobReference: s('concertoReference') ?? s('customerReference'),
      siteName: s('siteName') ?? '',
      siteAddress: s('siteAddress') ?? '',
      assetReference: s('assetReference'),
      jobDescription: s('description') ?? '',
      engineerName: s('engineerName'),
      joblogicStatus: s('status') ?? 'Unknown',
      scheduledDate: s('scheduledDate'),
      completedAt: s('completedAt'),
    };
  }

  normaliseCompletion(raw: Record<string, unknown>): NormalisedCompletion {
    // TODO(joblogic): map real completion field names.
    const num = (k: string) => (typeof raw[k] === 'number' ? (raw[k] as number) : null);
    const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : null);
    return {
      joblogicJobId: String(raw.jobId ?? ''),
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
      completionVersion: str('completionVersion') ?? str('revision'),
      raw,
    };
  }
}
