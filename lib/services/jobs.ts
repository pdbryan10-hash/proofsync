import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

export interface JobListFilters {
  status?: string; // SyncStatus or 'ALL'
  search?: string;
}

export interface JobListRow {
  id: string;
  concertoJobReference: string | null;
  joblogicJobId: string;
  siteName: string;
  jobDescription: string;
  engineerName: string | null;
  joblogicStatus: string;
  concertoStatus: string;
  syncStatus: string;
  lastSyncAt: string | null;
}

export async function listJobs(filters: JobListFilters = {}): Promise<JobListRow[]> {
  const where: Prisma.JobWhereInput = {};
  if (filters.status && filters.status !== 'ALL') {
    where.syncStatus = filters.status;
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { concertoJobReference: { contains: q } },
      { joblogicJobId: { contains: q } },
      { siteName: { contains: q } },
      { jobDescription: { contains: q } },
    ];
  }

  const jobs = await prisma.job.findMany({ where, orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }] });
  return jobs.map((j) => ({
    id: j.id,
    concertoJobReference: j.concertoJobReference,
    joblogicJobId: j.joblogicJobId,
    siteName: j.siteName,
    jobDescription: j.jobDescription,
    engineerName: j.engineerName,
    joblogicStatus: j.joblogicStatus,
    concertoStatus: j.concertoStatus,
    syncStatus: j.syncStatus,
    lastSyncAt: j.lastSyncAt ? j.lastSyncAt.toISOString() : null,
  }));
}

export async function getJobDetail(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      client: true,
      completion: true,
      documents: { orderBy: { createdAt: 'asc' } },
      exceptions: { orderBy: { createdAt: 'desc' } },
      syncRuns: {
        orderBy: { createdAt: 'desc' },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
}

export async function getJobCountsByStatus(): Promise<Record<string, number>> {
  const groups = await prisma.job.groupBy({ by: ['syncStatus'], _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const g of groups) out[g.syncStatus] = g._count._all;
  return out;
}
