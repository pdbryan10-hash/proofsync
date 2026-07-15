import { getConcertoCredentials } from '@/lib/config';
import {
  IntegrationAuthenticationError,
  IntegrationTimeoutError,
  IntegrationRateLimitError,
  IntegrationUnavailableError,
} from '@/lib/errors/integration-errors';
import type {
  ConcertoConnector,
  ConcertoTargetJob,
  ConcertoUpdateResult,
  ConcertoDocumentUploadResult,
  ConnectionTestResult,
  DownloadedDocument,
  VerificationResult,
} from '@/lib/integrations/types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * LIVE Concerto connector — production scaffold.
 *
 * ⚠️  DO NOT INVENT ENDPOINTS. Every `TODO(concerto)` marks a value that must be
 *     confirmed against the client's Concerto environment and API documentation
 *     (see docs/integration-checklist.md). Concerto access typically requires
 *     the client's approval and a service account.
 */
export class LiveConcertoConnector implements ConcertoConnector {
  readonly provider = 'CONCERTO' as const;
  readonly mode = 'live' as const;

  private readonly creds = getConcertoCredentials();

  private assertConfigured(): void {
    if (!this.creds.baseUrl || !this.creds.apiKey) {
      throw new IntegrationAuthenticationError(
        'Concerto live credentials are not configured. Set CONCERTO_API_BASE_URL and CONCERTO_API_KEY.',
      );
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.creds.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          // TODO(concerto): confirm auth scheme — likely OAuth2 client-credentials
          //   using CONCERTO_CLIENT_ID / CONCERTO_CLIENT_SECRET to mint a token.
          Authorization: `Bearer ${this.creds.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (res.status === 401 || res.status === 403) throw new IntegrationAuthenticationError();
      if (res.status === 429) throw new IntegrationRateLimitError();
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new IntegrationUnavailableError(`Concerto unavailable: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Concerto request failed: ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new IntegrationTimeoutError('Concerto request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    // TODO(concerto): real health/whoami endpoint.
    await this.request('/__TODO_healthcheck__');
    return {
      ok: true,
      provider: 'CONCERTO',
      mode: 'live',
      message: 'Concerto API reachable.',
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }

  async findJobByReference(concertoJobReference: string): Promise<ConcertoTargetJob[]> {
    // TODO(concerto): confirm the unique reference field name and lookup endpoint.
    const raw = await this.request<{ items: Record<string, unknown>[] }>(
      `/__TODO_jobs__?reference=${encodeURIComponent(concertoJobReference)}`,
    );
    return (raw.items ?? []).map((j) => ({
      concertoJobReference,
      status: String(j.status ?? 'Unknown'),
      fields: j,
    }));
  }

  async getJob(concertoJobReference: string): Promise<ConcertoTargetJob | null> {
    const matches = await this.findJobByReference(concertoJobReference);
    return matches[0] ?? null;
  }

  async updateJob(
    concertoJobReference: string,
    payload: Record<string, unknown>,
  ): Promise<ConcertoUpdateResult> {
    // TODO(concerto): confirm the permitted update endpoint + method (PATCH/PUT)
    //   and the exact target field names accepted.
    const raw = await this.request<Record<string, unknown>>(
      `/__TODO_jobs__/${encodeURIComponent(concertoJobReference)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    return {
      concertoJobReference,
      updatedFields: Object.keys(payload),
      status: String(raw.status ?? 'Unknown'),
      targetResponse: raw,
    };
  }

  async uploadDocument(
    concertoJobReference: string,
    document: DownloadedDocument,
  ): Promise<ConcertoDocumentUploadResult> {
    // TODO(concerto): confirm the document upload endpoint, multipart format and
    //   size/type limits; stream `document.content` rather than buffering large files.
    void concertoJobReference;
    void document;
    throw new Error('LiveConcertoConnector.uploadDocument not yet configured (TODO concerto).');
  }

  async updateJobStatus(concertoJobReference: string, status: string): Promise<void> {
    // TODO(concerto): confirm status transition endpoint + allowed transitions.
    await this.request(`/__TODO_jobs__/${encodeURIComponent(concertoJobReference)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async verifyUpdate(
    concertoJobReference: string,
    expectedValues: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const job = await this.getJob(concertoJobReference);
    const mismatches: VerificationResult['mismatches'] = [];
    if (!job) return { verified: false, mismatches: [] };
    for (const [field, expected] of Object.entries(expectedValues)) {
      if (JSON.stringify(job.fields[field]) !== JSON.stringify(expected)) {
        mismatches.push({ field, expected, actual: job.fields[field] });
      }
    }
    return { verified: mismatches.length === 0, mismatches };
  }
}
