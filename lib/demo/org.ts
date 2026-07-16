import { prisma } from '@/lib/db/prisma';
import { DEMO_ORG_NAME, DEMO_CLIENT_NAME, DEMO_CONCERTO_TENANT } from './config';

/**
 * ProofSync's own record of the demo tenant.
 *
 * The live-sync demo runs inside its OWN Organisation, deliberately separate
 * from the seeded product-tour org that /dashboard and /jobs render. Resetting
 * the demo must never destroy that data, and a reset endpoint that deletes by
 * organisation id cannot reach it.
 */

/** Concerto's field names — the target side of every mapping. */
const T = {
  notes: 'contractorCompletionNotes',
  work: 'workCompletionDescription',
  duration: 'actualLabourDuration',
  arrival: 'actualArrivalTime',
  departure: 'actualDepartureTime',
  completion: 'actualCompletionDate',
  cost: 'contractorCost',
  followOn: 'followOnRequired',
};

const MAPPINGS: {
  sourceField: string;
  targetField: string;
  transformationType: string;
  transformConfig?: string;
  sortOrder: number;
}[] = [
  { sourceField: 'workCompleted', targetField: T.work, transformationType: 'DIRECT', sortOrder: 1 },
  { sourceField: 'engineerNotes', targetField: T.notes, transformationType: 'DIRECT', sortOrder: 2 },
  { sourceField: 'arrivalTime', targetField: T.arrival, transformationType: 'DATETIME_FORMAT', sortOrder: 3 },
  { sourceField: 'departureTime', targetField: T.departure, transformationType: 'DATETIME_FORMAT', sortOrder: 4 },
  { sourceField: 'timeOnSiteMinutes', targetField: T.duration, transformationType: 'MINUTES_TO_HOURS', sortOrder: 5 },
  { sourceField: 'completedAt', targetField: T.completion, transformationType: 'DATETIME_FORMAT', sortOrder: 6 },
  {
    sourceField: 'followOnWorkRequired',
    targetField: T.followOn,
    transformationType: 'BOOLEAN_TO_TEXT',
    transformConfig: JSON.stringify({ trueText: 'Yes — follow-on raised', falseText: 'No' }),
    sortOrder: 7,
  },
  { sourceField: 'totalCost', targetField: T.cost, transformationType: 'CURRENCY_FORMAT', sortOrder: 8 },
];

export interface DemoOrg {
  organisationId: string;
  clientId: string;
}

/** Create the demo org/client/mappings if absent. Safe to call every tick. */
export async function ensureDemoOrg(): Promise<DemoOrg> {
  let org = await prisma.organisation.findFirst({ where: { name: DEMO_ORG_NAME } });
  if (!org) org = await prisma.organisation.create({ data: { name: DEMO_ORG_NAME } });

  let client = await prisma.client.findFirst({
    where: { organisationId: org.id, name: DEMO_CLIENT_NAME },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        organisationId: org.id,
        name: DEMO_CLIENT_NAME,
        concertoTenantName: DEMO_CONCERTO_TENANT,
        active: true,
        // Costs OFF is the interesting setting: the source carries a total
        // charge, and the console shows it being withheld by client rule rather
        // than quietly dropped.
        syncCompletionNotes: true,
        syncTimes: true,
        syncCosts: false,
        syncMaterials: false,
        syncDocuments: true,
        syncStatus: true,
        requireApprovalBeforeClose: false,
      },
    });
  }

  const mappingCount = await prisma.fieldMapping.count({ where: { organisationId: org.id } });
  if (mappingCount === 0) {
    await prisma.fieldMapping.createMany({
      data: MAPPINGS.map((m) => ({
        organisationId: org.id,
        clientId: null,
        sourceProvider: 'JOBLOGIC',
        targetProvider: 'CONCERTO',
        sourceField: m.sourceField,
        targetField: m.targetField,
        transformationType: m.transformationType,
        transformConfig: m.transformConfig ?? null,
        required: false,
        active: true,
        sortOrder: m.sortOrder,
      })),
    });
  }

  for (const provider of ['JOBLOGIC', 'CONCERTO'] as const) {
    const existing = await prisma.integrationConnection.findFirst({
      where: { organisationId: org.id, provider },
    });
    if (!existing) {
      await prisma.integrationConnection.create({
        data: {
          organisationId: org.id,
          provider,
          name: provider === 'JOBLOGIC' ? 'Joblogic (demo system)' : 'Concerto (demo system)',
          status: 'CONNECTED',
          environment: 'demo',
        },
      });
    }
  }

  return { organisationId: org.id, clientId: client.id };
}

/**
 * Delete every ProofSync record belonging to the demo org, in dependency order
 * (Mongo has no cascade). Scoped by organisation id throughout — nothing outside
 * the demo tenant is reachable from here.
 */
export async function resetDemoLedger(organisationId: string): Promise<void> {
  const jobs = await prisma.job.findMany({
    where: { organisationId },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);

  if (jobIds.length) {
    const runs = await prisma.syncRun.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);

    if (runIds.length) await prisma.syncEvent.deleteMany({ where: { syncRunId: { in: runIds } } });
    await prisma.exception.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.syncRun.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.document.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.jobCompletion.deleteMany({ where: { jobId: { in: jobIds } } });

    const jobNumbers = await prisma.job.findMany({
      where: { organisationId },
      select: { joblogicJobId: true },
    });
    await prisma.processedEvent.deleteMany({
      where: { joblogicJobId: { in: jobNumbers.map((j) => j.joblogicJobId) } },
    });
    await prisma.job.deleteMany({ where: { organisationId } });
  }
}
