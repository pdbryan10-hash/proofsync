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
  // Source + target must be trimmed TOGETHER: the ledger trim is independent
  // (below) and safe, but pruning the two stand-in systems by unrelated keys
  // orphans jobs from their work orders and makes the next sync raise spurious
  // "no matching work order" exceptions.
  await trimSourceAndTarget(keep);
  await trimLedger(keep).catch(() => {});
}

/**
 * Keep the newest `keep` source jobs and every work order that belongs to one of
 * them. The source is the spine; the target is pruned to MATCH by reference so no
 * surviving job ever loses its work order. (The target's own createdAt is
 * randomly backdated for display, so trimming it independently by createdAt
 * deleted work orders of freshly-created jobs — the cause of the exception flood.)
 */
async function trimSourceAndTarget(keep: number): Promise<void> {
  const jobs = await sourceJobs();
  const total = await jobs.countDocuments({});
  if (total <= keep) return;

  const kept = await jobs
    .find({}, { projection: { jobNumber: 1, customerOrderRef: 1 }, sort: { createdAt: -1 } })
    .limit(keep)
    .toArray();
  const keptJobNumbers = kept.map((j) => j.jobNumber);
  const keptRefs = kept.map((j) => j.customerOrderRef).filter((r): r is string => !!r);

  await jobs.deleteMany({ jobNumber: { $nin: keptJobNumbers } });

  // Only prune the target once we actually have a reference set to keep, so an
  // unlucky all-faulted window can't wipe every work order.
  if (keptRefs.length) {
    const wos = await targetWorkOrders();
    await wos.deleteMany({ reference: { $nin: keptRefs } });
  }
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
  // Runs by the same id snapshot as their events (see resetDemoLedger).
  if (runIds.length) await prisma.syncRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.document.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.jobCompletion.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.processedEvent.deleteMany({
    where: { joblogicJobId: { in: old.map((j) => j.joblogicJobId) } },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}
