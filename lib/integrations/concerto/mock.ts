import { prisma } from '@/lib/db/prisma';
import {
  DocumentTransferError,
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

const nowIso = () => new Date().toISOString();

function parseFields(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Mock Concerto connector.
 *
 * The MockConcertoJob table IS the mock Concerto system. `updateJob` writes real
 * values into it, so the demo's "inspect target before → sync → inspect target
 * after" genuinely changes stored data rather than showing a cosmetic toast.
 */
export class MockConcertoConnector implements ConcertoConnector {
  readonly provider = 'CONCERTO' as const;
  readonly mode = 'mock' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    const count = await prisma.mockConcertoJob.count();
    return {
      ok: true,
      provider: 'CONCERTO',
      mode: 'mock',
      message: `Mock Concerto reachable — ${count} target jobs available.`,
      latencyMs: Date.now() - start,
      checkedAt: nowIso(),
    };
  }

  async findJobByReference(concertoJobReference: string): Promise<ConcertoTargetJob[]> {
    // A unique reference should match exactly one job. The array return type
    // makes 0 (not found) and >1 (ambiguous) first-class, verifiable outcomes.
    const matches = await prisma.mockConcertoJob.findMany({
      where: { concertoJobReference },
    });
    return matches.map((m) => ({
      concertoJobReference: m.concertoJobReference,
      status: m.status,
      fields: parseFields(m.fields),
    }));
  }

  async getJob(concertoJobReference: string): Promise<ConcertoTargetJob | null> {
    const m = await prisma.mockConcertoJob.findUnique({ where: { concertoJobReference } });
    if (!m) return null;
    return {
      concertoJobReference: m.concertoJobReference,
      status: m.status,
      fields: parseFields(m.fields),
    };
  }

  async updateJob(
    concertoJobReference: string,
    payload: Record<string, unknown>,
  ): Promise<ConcertoUpdateResult> {
    const m = await prisma.mockConcertoJob.findUnique({ where: { concertoJobReference } });
    if (!m) {
      // Guard: never create a Concerto job; only update an existing matched one.
      throw new IntegrationUnavailableError(
        `Concerto job ${concertoJobReference} disappeared before update.`,
      );
    }

    if (m.mockUpdateShouldFail) {
      // Simulate a transient outage once, then clear the flag so a retry succeeds.
      await prisma.mockConcertoJob.update({
        where: { concertoJobReference },
        data: { mockUpdateShouldFail: false },
      });
      throw new IntegrationUnavailableError(
        'Concerto API temporarily unavailable (HTTP 503).',
      );
    }

    const existing = parseFields(m.fields);
    const merged = { ...existing, ...payload };

    await prisma.mockConcertoJob.update({
      where: { concertoJobReference },
      data: { fields: JSON.stringify(merged) },
    });

    return {
      concertoJobReference,
      updatedFields: Object.keys(payload),
      status: m.status,
      targetResponse: { ok: true, reference: concertoJobReference, appliedFields: Object.keys(payload) },
    };
  }

  async uploadDocument(
    concertoJobReference: string,
    document: DownloadedDocument,
  ): Promise<ConcertoDocumentUploadResult> {
    // Demo failure hook: a document flagged mockUploadShouldFail rejects, which
    // drives the PARTIAL sync outcome (core data synced, one document failed).
    const source = await prisma.document.findUnique({
      where: { id: document.sourceDocumentId },
    });
    if (source?.mockUploadShouldFail) {
      throw new DocumentTransferError(
        document.filename,
        `Concerto rejected upload of ${document.filename} (mock virus-scan timeout).`,
      );
    }

    const concertoDocumentId = `CON-DOC-${document.sourceDocumentId.slice(-8)}`;
    return {
      sourceDocumentId: document.sourceDocumentId,
      concertoDocumentId,
      filename: document.filename,
    };
  }

  async updateJobStatus(concertoJobReference: string, status: string): Promise<void> {
    await prisma.mockConcertoJob.update({
      where: { concertoJobReference },
      data: { status },
    });
  }

  async verifyUpdate(
    concertoJobReference: string,
    expectedValues: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const job = await this.getJob(concertoJobReference);
    const mismatches: VerificationResult['mismatches'] = [];
    if (!job) {
      return {
        verified: false,
        mismatches: Object.entries(expectedValues).map(([field, expected]) => ({
          field,
          expected,
          actual: undefined,
        })),
      };
    }
    for (const [field, expected] of Object.entries(expectedValues)) {
      const actual = job.fields[field];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({ field, expected, actual });
      }
    }
    return { verified: mismatches.length === 0, mismatches };
  }
}
