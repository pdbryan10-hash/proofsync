import { prisma } from '@/lib/db/prisma';
import { sourceJobs, targetWorkOrders } from './mongo';
import { getDemoOrgId } from './org';
import { getEstimatedManualMinutesPerJob } from '@/lib/config';

/**
 * Read model for the user terminal — the real operational view a signed-in user
 * would see. Joins BOTH stand-in systems (Joblogic source + Concerto target, from
 * Mongo) with ProofSync's own ledger (Prisma) into one row per job, so a user can
 * see, for every job, where it is in each system and what still needs them.
 */

export interface TerminalRow {
  jobNumber: string;
  reference: string | null;
  description: string;
  site: string;
  engineer: string | null;
  completedAt: string | null;
  joblogicStatus: string;
  concertoStatus: string;
  syncStatus: string;
  fieldsWritten: number;
  documents: number;
  exception: { label: string; message: string } | null;
  jobId: string | null;
}

export interface TerminalData {
  rows: TerminalRow[];
  summary: {
    total: number;
    synced: number;
    partial: number;
    exceptions: number;
    awaiting: number;
    hoursReturned: number;
  };
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '';

export async function getTerminalData(): Promise<TerminalData> {
  const orgId = await getDemoOrgId();
  const [jobsCol, wosCol] = await Promise.all([sourceJobs(), targetWorkOrders()]);
  const [srcJobs, wos, pJobs, raisedJobs] = await Promise.all([
    jobsCol.find({}).sort({ jobNumber: 1 }).toArray(),
    wosCol.find({}).toArray(),
    prisma.job.findMany({
      where: { organisationId: orgId },
      select: { id: true, joblogicJobId: true, syncStatus: true },
    }),
    prisma.job.findMany({
      where: {
        organisationId: orgId,
        exceptions: { some: { status: { in: ['OPEN', 'IN_REVIEW', 'RETRYING'] } } },
      },
      select: { joblogicJobId: true },
    }),
  ]);

  const woByRef = new Map(wos.map((w) => [w.reference, w]));
  const pByJobNo = new Map(pJobs.map((j) => [j.joblogicJobId, j]));
  const raised = new Set(raisedJobs.map((j) => j.joblogicJobId));

  const rows: TerminalRow[] = srcJobs.map((s) => {
    const wo = s.customerOrderRef ? woByRef.get(s.customerOrderRef) : undefined;
    const p = pByJobNo.get(s.jobNumber);
    const fieldsWritten = Object.values(wo?.attributes ?? {}).filter(hasValue).length;
    // Only an exception once ProofSync has actually tried it and been refused —
    // not just because the work order carries a seeded block.
    const block = wo?.demoBlock && raised.has(s.jobNumber) ? wo.demoBlock : null;
    return {
      jobNumber: s.jobNumber,
      reference: s.customerOrderRef,
      description: s.description,
      site: s.siteName,
      engineer: s.engineer?.engineerName ?? null,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      joblogicStatus: s.status,
      concertoStatus: wo ? wo.status : 'No work order',
      syncStatus: p?.syncStatus ?? 'PENDING',
      fieldsWritten,
      documents: wo?.documents?.length ?? 0,
      exception: block ? { label: block.label, message: block.message } : null,
      jobId: p?.id ?? null,
    };
  });

  const synced = rows.filter((r) => r.syncStatus === 'SYNCED').length;
  const partial = rows.filter((r) => r.syncStatus === 'PARTIAL').length;
  const exceptions = rows.filter((r) => r.exception).length;
  const awaiting = rows.filter((r) => ['PENDING', 'READY', 'SYNCING'].includes(r.syncStatus)).length;
  const minutes = (synced + partial) * getEstimatedManualMinutesPerJob();

  return {
    rows,
    summary: {
      total: rows.length,
      synced,
      partial,
      exceptions,
      awaiting,
      hoursReturned: Math.round((minutes / 60) * 10) / 10,
    },
  };
}
