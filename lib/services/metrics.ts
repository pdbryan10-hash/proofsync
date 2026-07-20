import { prisma } from '@/lib/db/prisma';
import { getManualMinutesRoundTrip } from '@/lib/config';
import { getDemoOrgId } from '@/lib/demo/org';

export interface DashboardMetrics {
  jobsProcessedToday: number;
  successfullySynced: number;
  adminHoursSavedToday: number;
  openExceptions: number;
  successRatePct: number;
  estimatedMinutesPerJob: number;
  monthHoursSaved: number;
  monthWorkingDaysReturned: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Aggregates dashboard KPIs. Admin-time saved is an ESTIMATE derived from
 * successful syncs × configured minutes-per-job — clearly labelled as such in
 * the UI (§16).
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // The closed loop moves each job BOTH ways (in + out), so credit the full
  // round trip per synced job — matches the finale card's basis (20 min/job).
  const minutes = getManualMinutesRoundTrip();
  const today = startOfToday();
  const month = startOfMonth();
  const orgId = await getDemoOrgId();
  const inOrg = { job: { organisationId: orgId } } as const;

  const [processedToday, syncedToday, openExceptions, totalTerminalToday, syncedThisMonth] =
    await Promise.all([
      prisma.syncRun.count({ where: { startedAt: { gte: today }, ...inOrg } }),
      prisma.syncRun.count({ where: { startedAt: { gte: today }, status: { in: ['SUCCESS', 'PARTIAL'] }, ...inOrg } }),
      prisma.exception.count({ where: { status: { in: ['OPEN', 'IN_REVIEW', 'RETRYING'] }, ...inOrg } }),
      prisma.syncRun.count({ where: { startedAt: { gte: today }, status: { in: ['SUCCESS', 'PARTIAL', 'FAILED', 'EXCEPTION'] }, ...inOrg } }),
      prisma.syncRun.count({ where: { startedAt: { gte: month }, status: { in: ['SUCCESS', 'PARTIAL'] }, ...inOrg } }),
    ]);

  const successRatePct = totalTerminalToday === 0 ? 100 : Math.round((syncedToday / totalTerminalToday) * 1000) / 10;
  const adminHoursSavedToday = Math.round((syncedToday * minutes) / 60 * 10) / 10;
  const monthHoursSaved = Math.round((syncedThisMonth * minutes) / 60 * 10) / 10;
  const monthWorkingDaysReturned = Math.round((monthHoursSaved / 7.5) * 10) / 10;

  return {
    jobsProcessedToday: processedToday,
    successfullySynced: syncedToday,
    adminHoursSavedToday,
    openExceptions,
    successRatePct,
    estimatedMinutesPerJob: minutes,
    monthHoursSaved,
    monthWorkingDaysReturned,
  };
}

export interface DailySyncPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Mon 14"
  success: number;
  partial: number;
  exception: number;
}

/** Sync activity for the trailing `days` days, for the dashboard chart. */
export async function getSyncActivity(days = 14): Promise<DailySyncPoint[]> {
  const start = startOfToday();
  start.setDate(start.getDate() - (days - 1));

  const runs = await prisma.syncRun.findMany({
    where: { startedAt: { gte: start }, job: { organisationId: await getDemoOrgId() } },
    select: { startedAt: true, status: true },
  });

  const buckets = new Map<string, DailySyncPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
      success: 0,
      partial: 0,
      exception: 0,
    });
  }

  for (const run of runs) {
    if (!run.startedAt) continue;
    const key = run.startedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (run.status === 'SUCCESS') bucket.success += 1;
    else if (run.status === 'PARTIAL') bucket.partial += 1;
    else if (run.status === 'EXCEPTION' || run.status === 'FAILED') bucket.exception += 1;
  }

  return Array.from(buckets.values());
}

export interface RecentSyncRow {
  id: string;
  time: string;
  concertoReference: string | null;
  site: string;
  jobDescription: string;
  status: string;
  durationMs: number | null;
  jobId: string;
}

export async function getRecentSyncs(limit = 8): Promise<RecentSyncRow[]> {
  const runs = await prisma.syncRun.findMany({
    where: { job: { organisationId: await getDemoOrgId() } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { job: true },
  });
  return runs.map((r) => ({
    id: r.id,
    time: (r.startedAt ?? r.createdAt).toISOString(),
    concertoReference: r.job.concertoJobReference,
    site: r.job.siteName,
    jobDescription: r.job.jobDescription,
    status: r.status,
    durationMs: r.durationMs,
    jobId: r.jobId,
  }));
}
