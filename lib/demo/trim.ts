import { prisma } from '@/lib/db/prisma';
import { sourceJobs, targetWorkOrders } from './mongo';
import { ensureDemoOrg } from './org';

/**
 * Keep the demo bounded.
 *
 * Every open injects a burst and the cadence drips more, so left alone the two
 * stand-in systems and the ledger grow without limit — and the headline stats
 * ("re-keying avoided") climb to implausible numbers. This holds a rolling
 * window: only the most recent N jobs survive in each store, oldest trimmed.
 * Called at the end of every beat, so the demo can run indefinitely and still
 * look like a real week's worth of work.
 */
function keepCount(): number {
  const raw = Number(process.env.DEMO_KEEP_JOBS);
  return Number.isFinite(raw) && raw >= 10 ? raw : 40;
}

export async function trimDemo(): Promise<void> {
  const keep = keepCount();
  await Promise.all([trimSource(keep), trimTarget(keep), trimLedger(keep)]);
}

async function trimSource(keep: number): Promise<void> {
  const jobs = await sourceJobs();
  const count = await jobs.countDocuments({});
  if (count <= keep) return;
  const old = await jobs
    .find({}, { projection: { _id: 1 }, sort: { createdAt: 1 } })
    .limit(count - keep)
    .toArray();
  if (old.length) await jobs.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

async function trimTarget(keep: number): Promise<void> {
  const wos = await targetWorkOrders();
  const count = await wos.countDocuments({});
  if (count <= keep) return;
  const old = await wos
    .find({}, { projection: { _id: 1 }, sort: { createdAt: 1 } })
    .limit(count - keep)
    .toArray();
  if (old.length) await wos.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

/**
 * Trim ProofSync's own ledger for the demo org — oldest jobs first, children
 * before parents (Mongo has no cascade), deleting by the same id snapshot so a
 * job created mid-trim is simply left for next time.
 */
async function trimLedger(keep: number): Promise<void> {
  const { organisationId } = await ensureDemoOrg();
  const total = await prisma.job.count({ where: { organisationId } });
  if (total <= keep) return;

  const old = await prisma.job.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'asc' },
    take: total - keep,
    select: { id: true, joblogicJobId: true },
  });
  const jobIds = old.map((j) => j.id);
  if (!jobIds.length) return;

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
  await prisma.processedEvent.deleteMany({
    where: { joblogicJobId: { in: old.map((j) => j.joblogicJobId) } },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}
