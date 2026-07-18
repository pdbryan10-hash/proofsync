import { prisma } from '@/lib/db/prisma';
import {
  DocumentTransferError,
  IntegrationUnavailableError,
  ValidationError,
} from '@/lib/errors/integration-errors';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { withSession } from '@/lib/demo/session';
import type { TargetWorkOrderDoc } from '@/lib/demo/schema';
import type { IntakeJob } from '@/lib/demo/intake';
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

/**
 * Demo Concerto connector — writes the TARGET system's own database (DB2) over a
 * simulated user session.
 *
 * Every write here lands in a database ProofSync does not otherwise touch, in
 * Concerto's own vocabulary. "Inspect the target before, run the sync, inspect
 * the target after" shows genuinely changed stored data in a genuinely separate
 * system — not a toast, and not a row in our own tables wearing a costume.
 *
 * Two guarantees are load-bearing and mirror the live connector's contract:
 *   - It NEVER creates a work order. Concerto owns its own records; ProofSync
 *     only updates one it has positively matched. A missing target is an
 *     exception, never an insert.
 *   - It never writes without a reference the engine has already validated.
 */
export class DemoConcertoConnector implements ConcertoConnector {
  readonly provider = 'CONCERTO' as const;
  readonly mode = 'demo' as const;

  /**
   * INBOUND seam — pull work orders the client raised that still need a
   * contractor and haven't been picked up into the field system yet. This is the
   * "refresh the jobs page for new work" a person does today, as a connector call.
   */
  async receiveNewJobs(): Promise<IntakeJob[]> {
    return withSession('CONCERTO', async () => {
      const wos = await targetWorkOrders();
      const raised = await wos
        .find({
          inbound: true,
          $or: [{ joblogicJobNumber: null }, { joblogicJobNumber: { $exists: false } }],
        })
        .sort({ reference: 1 })
        .toArray();
      return raised.map((w) => ({
        reference: w.reference,
        siteName: w.property.propertyName,
        siteAddress: w.property.propertyAddress,
        assetRef: w.assetId ?? null,
        summary: w.summary,
      }));
    });
  }

  /**
   * INBOUND seam — acknowledge that a raised job has been picked up into the field
   * system, so a re-poll never imports it twice. Note it does NOT create a Concerto
   * record; Concerto owns its own — this only records the pickup on the existing one.
   */
  async markReceived(reference: string, joblogicJobNumber: string): Promise<void> {
    await withSession('CONCERTO', async () => {
      const wos = await targetWorkOrders();
      await wos.updateOne(
        { reference },
        { $set: { joblogicJobNumber, pickedUpAt: new Date(), status: 'In Progress', updatedAt: new Date() } },
      );
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    return withSession('CONCERTO', async (session) => {
      const wos = await targetWorkOrders();
      const count = await wos.countDocuments({});
      return {
        ok: true,
        provider: 'CONCERTO' as const,
        mode: 'demo' as const,
        message: `Signed in to Concerto as ${session.username} — ${count} work orders visible.`,
        latencyMs: Date.now() - start,
        checkedAt: nowIso(),
      };
    });
  }

  async findJobByReference(concertoJobReference: string): Promise<ConcertoTargetJob[]> {
    return withSession('CONCERTO', async () => {
      const wos = await targetWorkOrders();
      // Array return keeps 0 (not found) and >1 (ambiguous) first-class, so the
      // engine can refuse to write rather than picking one and hoping.
      const matches = await wos.find({ reference: concertoJobReference }).toArray();
      return matches.map(toTargetJob);
    });
  }

  async getJob(concertoJobReference: string): Promise<ConcertoTargetJob | null> {
    return withSession('CONCERTO', async () => {
      const wos = await targetWorkOrders();
      const wo = await wos.findOne({ reference: concertoJobReference });
      return wo ? toTargetJob(wo) : null;
    });
  }

  async updateJob(
    concertoJobReference: string,
    payload: Record<string, unknown>,
  ): Promise<ConcertoUpdateResult> {
    return withSession('CONCERTO', async (session) => {
      const wos = await targetWorkOrders();
      const wo = await wos.findOne({ reference: concertoJobReference });
      if (!wo) {
        // Guard: never create. The match stage already found this record, so its
        // disappearance is a real fault, not licence to insert one.
        throw new IntegrationUnavailableError(
          `Concerto work order ${concertoJobReference} disappeared before update.`,
        );
      }

      if (wo.simulateUpdateFailure) {
        // Fail once, then clear, so the operator's retry genuinely succeeds
        // rather than the demo pretending a retry happened.
        await wos.updateOne(
          { reference: concertoJobReference },
          { $set: { simulateUpdateFailure: false } },
        );
        throw new IntegrationUnavailableError('Concerto returned HTTP 503 (service unavailable).');
      }

      if (wo.demoBlock) {
        // A PERSISTENT validation rejection (non-retryable): the client's system
        // won't accept this save until a person corrects it. It stays "needs a
        // person" until the resolve endpoint clears the block, at which point the
        // very next sync goes through — nothing self-heals.
        throw new ValidationError(wo.demoBlock.message, [wo.demoBlock.label]);
      }

      // Merge into the attribute bag: a sync updates the fields it owns and
      // leaves everything Concerto knows that we don't strictly alone.
      const attributes = { ...(wo.attributes ?? {}), ...payload };
      await wos.updateOne(
        { reference: concertoJobReference },
        {
          $set: {
            attributes,
            lastUpdatedBy: session.username,
            updatedAt: new Date(),
          },
        },
      );

      return {
        concertoJobReference,
        updatedFields: Object.keys(payload),
        status: wo.status,
        targetResponse: {
          ok: true,
          reference: concertoJobReference,
          appliedFields: Object.keys(payload),
          updatedBy: session.username,
          system: 'concerto-demo',
        },
      };
    });
  }

  async uploadDocument(
    concertoJobReference: string,
    document: DownloadedDocument,
  ): Promise<ConcertoDocumentUploadResult> {
    // Failure hook lives on our own document row (mirrored from the source
    // attachment at ingest), matching how the mock connector drives the PARTIAL
    // outcome — core data synced, one document rejected.
    const source = await prisma.document.findUnique({
      where: { id: document.sourceDocumentId },
    });
    if (source?.mockUploadShouldFail) {
      throw new DocumentTransferError(
        document.filename,
        `Concerto rejected upload of ${document.filename} (virus-scan timeout).`,
      );
    }

    return withSession('CONCERTO', async (session) => {
      const wos = await targetWorkOrders();
      const concertoDocumentId = `CON-DOC-${document.sourceDocumentId.slice(-8)}`;

      // Idempotent by document id: re-running a sync must not stack duplicates
      // in the client's record.
      await wos.updateOne(
        { reference: concertoJobReference, 'documents.documentId': { $ne: concertoDocumentId } },
        {
          $push: {
            documents: {
              documentId: concertoDocumentId,
              fileName: document.filename,
              uploadedAt: new Date(),
              uploadedBy: session.username,
            },
          },
          $set: { updatedAt: new Date() },
        },
      );

      return {
        sourceDocumentId: document.sourceDocumentId,
        concertoDocumentId,
        filename: document.filename,
      };
    });
  }

  async updateJobStatus(concertoJobReference: string, status: string): Promise<void> {
    await withSession('CONCERTO', async (session) => {
      const wos = await targetWorkOrders();
      await wos.updateOne(
        { reference: concertoJobReference },
        {
          $set: {
            status: status as TargetWorkOrderDoc['status'],
            lastUpdatedBy: session.username,
            updatedAt: new Date(),
          },
        },
      );
    });
  }

  async verifyUpdate(
    concertoJobReference: string,
    expectedValues: Record<string, unknown>,
  ): Promise<VerificationResult> {
    // Deliberately a fresh read-back rather than trusting the write's response:
    // "we sent it" and "they stored it" are different claims, and only the
    // second one is worth putting in front of a client.
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

// --- Concerto dialect → normalised ------------------------------------------

function toTargetJob(wo: TargetWorkOrderDoc): ConcertoTargetJob {
  return {
    concertoJobReference: wo.reference,
    status: wo.status,
    fields: wo.attributes ?? {},
  };
}
