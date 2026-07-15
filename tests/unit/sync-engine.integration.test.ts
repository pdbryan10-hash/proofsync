import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { JobCompletionSyncService } from '@/lib/sync/job-completion-sync-service';

/**
 * End-to-end sync-engine test against the mock connectors and the real (SQLite)
 * database. Proves the demo claim: a sync ACTUALLY writes values into the mock
 * Concerto target. Creates its own isolated fixtures and cleans them up, so it
 * is safe to run against the seeded dev database. Skips if the DB is not seeded.
 */

const REF = 'CON-900123';
const JL = 'JL-TEST-900123';

// Determine up-front whether the demo DB is available/seeded.
const org = await prisma.organisation.findFirst().catch(() => null);
const client = org ? await prisma.client.findFirst({ where: { organisationId: org.id } }) : null;
const ready = !!org && !!client;

async function cleanup() {
  await prisma.processedEvent.deleteMany({ where: { joblogicJobId: JL } });
  const job = await prisma.job.findFirst({ where: { joblogicJobId: JL } });
  if (job) {
    // MongoDB has no referential actions — remove children explicitly.
    const runs = await prisma.syncRun.findMany({ where: { jobId: job.id }, select: { id: true } });
    await prisma.syncEvent.deleteMany({ where: { syncRunId: { in: runs.map((r) => r.id) } } });
    await prisma.exception.deleteMany({ where: { jobId: job.id } });
    await prisma.syncRun.deleteMany({ where: { jobId: job.id } });
    await prisma.document.deleteMany({ where: { jobId: job.id } });
    await prisma.jobCompletion.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
  }
  await prisma.mockConcertoJob.deleteMany({ where: { concertoJobReference: REF } });
}

describe.skipIf(!ready)('JobCompletionSyncService (mock, e2e)', () => {
  let jobId: string;

  beforeAll(async () => {
    await cleanup();
    const job = await prisma.job.create({
      data: {
        organisationId: org!.id,
        clientId: client!.id,
        joblogicJobId: JL,
        concertoJobReference: REF,
        siteName: 'Test Site',
        siteAddress: 'Test Address',
        jobDescription: 'Engine integration test job',
        engineerName: 'Test Engineer',
        joblogicStatus: 'Complete',
        concertoStatus: 'In Progress',
        completedAt: new Date(),
        syncStatus: 'READY',
        completion: {
          create: {
            timeOnSiteMinutes: 127,
            workCompleted: 'Replaced failed emergency lighting battery pack.',
            engineerNotes: 'Tested and confirmed operational.',
            totalCost: 160.5,
            followOnWorkRequired: false,
            completedAt: new Date(),
          },
        },
        documents: {
          create: { filename: 'Test_Certificate.pdf', documentType: 'CERTIFICATE', mimeType: 'application/pdf', sizeBytes: 100_000 },
        },
      },
    });
    jobId = job.id;
    await prisma.mockConcertoJob.create({
      data: { concertoJobReference: REF, status: 'In Progress', fields: JSON.stringify({}) },
    });
  }, 30_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('syncs completion data into the mock Concerto target and marks the job SYNCED', async () => {
    const service = new JobCompletionSyncService();
    const result = await service.run({ jobId, triggerType: 'MANUAL' });

    expect(result.status).toBe('SUCCESS');

    const target = await prisma.mockConcertoJob.findUnique({ where: { concertoJobReference: REF } });
    const fields = JSON.parse(target!.fields) as Record<string, unknown>;
    expect(fields.contractorCompletionNotes).toBe('Tested and confirmed operational.');
    expect(fields.workCompletionDescription).toContain('emergency lighting');
    expect(fields.actualLabourDuration).toBeCloseTo(2.12, 2);
    // Costs are off by default policy → must NOT be written.
    expect(fields).not.toHaveProperty('contractorCost');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.syncStatus).toBe('SYNCED');
    expect(job!.lastSyncAt).not.toBeNull();

    const docs = await prisma.document.findMany({ where: { jobId } });
    expect(docs[0]!.transferStatus).toBe('TRANSFERRED');
  }, 30_000);

  it('is idempotent: a duplicate webhook event is ignored', async () => {
    const service = new JobCompletionSyncService();
    const key = 'evt:test-idem-900123';
    const first = await service.run({ jobId, triggerType: 'WEBHOOK', idempotencyKey: key });
    expect(['SUCCESS', 'PARTIAL']).toContain(first.status);
    const second = await service.run({ jobId, triggerType: 'WEBHOOK', idempotencyKey: key });
    expect(second.skipped).toBe(true);
    expect(second.status).toBe('IGNORED');
  }, 30_000);
});
