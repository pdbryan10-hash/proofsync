import { prisma } from '@/lib/db/prisma';
import { getEstimatedManualMinutesPerJob } from '@/lib/config';
import { sourceJobs, targetWorkOrders } from './mongo';
import { peekSession } from './session';
import { timeToNextTick } from './tick';
import { getTickSeconds, getSourceDbName, getTargetDbName } from './config';
import { ensureDemoOrg } from './org';
import { TARGET_FIELD_LABELS, targetFieldLabel } from '@/lib/domain/field-labels';

/**
 * The console's read model — all three panels in one round trip.
 *
 * Each panel is read from the system that actually owns it: the source panel
 * from DB1, the target panel from DB2, the ledger from ProofSync's own store.
 * Nothing is reconstructed or inferred from one place and presented as three.
 * If DB2 says a field is populated, it is because DB2 was asked.
 */

const PANEL_LIMIT = 14;

export interface SourceRow {
  jobNumber: string;
  description: string;
  siteName: string;
  engineerName: string | null;
  status: string;
  customerOrderRef: string | null;
  completedAt: string | null;
  revision: number;
  updatedAt: string;
}

export interface LedgerRow {
  id: string;
  jobNumber: string;
  reference: string | null;
  status: string;
  attemptNumber: number;
  durationMs: number | null;
  fieldsUpdated: number;
  documentsTransferred: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TargetRow {
  reference: string;
  status: string;
  summary: string;
  propertyName: string;
  populatedFields: { field: string; label: string; preview: string }[];
  emptyFieldCount: number;
  documentCount: number;
  lastUpdatedBy: string | null;
  updatedAt: string;
}

export interface DemoState {
  transport: 'simulated';
  databases: { source: string; target: string; ledger: string };
  tick: { lastTickAt: string | null; nextTickInMs: number; tickCount: number; tickSeconds: number };
  sessions: {
    joblogic: { username: string; expiresAt: string } | null;
    concerto: { username: string; expiresAt: string } | null;
  };
  source: SourceRow[];
  ledger: LedgerRow[];
  target: TargetRow[];
  stats: {
    sourceTotal: number;
    sourceComplete: number;
    sourceInFlight: number;
    synced: number;
    partial: number;
    openExceptions: number;
    awaitingSync: number;
    targetPopulated: number;
    targetTotal: number;
    adminMinutesSaved: number;
  };
  seeded: boolean;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** All the target field names the mappings can write, for the "empty" count. */
const KNOWN_TARGET_FIELDS = Object.keys(TARGET_FIELD_LABELS);

function previewValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value);
  return s.length > 90 ? `${s.slice(0, 89)}…` : s;
}

export async function getDemoState(): Promise<DemoState> {
  const { organisationId } = await ensureDemoOrg();

  const [jobsCol, wosCol] = await Promise.all([sourceJobs(), targetWorkOrders()]);

  const [
    sourceDocs,
    sourceTotal,
    sourceComplete,
    sourceInFlight,
    targetDocs,
    targetTotal,
    runs,
    synced,
    partial,
    openExceptions,
    awaitingSync,
    tick,
  ] = await Promise.all([
    jobsCol.find({}).sort({ updatedAt: -1 }).limit(PANEL_LIMIT).toArray(),
    jobsCol.countDocuments({}),
    jobsCol.countDocuments({ status: 'Complete' }),
    jobsCol.countDocuments({ status: { $in: ['Allocated', 'Travelling', 'On Site'] } }),
    wosCol.find({}).sort({ updatedAt: -1 }).limit(PANEL_LIMIT).toArray(),
    wosCol.countDocuments({}),
    prisma.syncRun.findMany({
      where: { job: { organisationId } },
      orderBy: { createdAt: 'desc' },
      take: PANEL_LIMIT,
      include: { job: { select: { joblogicJobId: true, concertoJobReference: true } } },
    }),
    prisma.job.count({ where: { organisationId, syncStatus: 'SYNCED' } }),
    prisma.job.count({ where: { organisationId, syncStatus: 'PARTIAL' } }),
    prisma.exception.count({ where: { job: { organisationId }, status: { in: ['OPEN', 'IN_REVIEW'] } } }),
    prisma.job.count({ where: { organisationId, syncStatus: { in: ['PENDING', 'READY', 'SYNCING'] } } }),
    timeToNextTick(),
  ]);

  const targetPopulated = await wosCol.countDocuments({
    // A work order counts as populated once the sync has written anything into it.
    lastUpdatedBy: { $ne: null },
  });

  return {
    transport: 'simulated',
    databases: {
      source: getSourceDbName(),
      target: getTargetDbName(),
      ledger: 'see_cafm_sync',
    },
    tick: {
      lastTickAt: iso(tick.lastTickAt),
      nextTickInMs: tick.nextTickInMs,
      tickCount: tick.tickCount,
      tickSeconds: getTickSeconds(),
    },
    sessions: {
      joblogic: sessionView('JOBLOGIC'),
      concerto: sessionView('CONCERTO'),
    },
    source: sourceDocs.map((d) => ({
      jobNumber: d.jobNumber,
      description: d.description,
      siteName: d.siteName,
      engineerName: d.engineer?.engineerName ?? null,
      status: d.status,
      customerOrderRef: d.customerOrderRef,
      completedAt: iso(d.completedAt),
      revision: d.revision ?? 1,
      updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
    })),
    ledger: runs.map((r) => ({
      id: r.id,
      jobNumber: r.job.joblogicJobId,
      reference: r.job.concertoJobReference,
      status: r.status,
      attemptNumber: r.attemptNumber,
      durationMs: r.durationMs,
      fieldsUpdated: r.fieldsUpdated,
      documentsTransferred: r.documentsTransferred,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      startedAt: iso(r.startedAt),
      completedAt: iso(r.completedAt),
    })),
    target: targetDocs.map((w) => {
      const attributes = w.attributes ?? {};
      const populatedFields = Object.entries(attributes)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([field, v]) => ({
          field,
          label: targetFieldLabel(field),
          preview: previewValue(v),
        }));
      return {
        reference: w.reference,
        status: w.status,
        summary: w.summary,
        propertyName: w.property?.propertyName ?? '—',
        populatedFields,
        emptyFieldCount: Math.max(0, KNOWN_TARGET_FIELDS.length - populatedFields.length),
        documentCount: w.documents?.length ?? 0,
        lastUpdatedBy: w.lastUpdatedBy,
        updatedAt: iso(w.updatedAt) ?? new Date().toISOString(),
      };
    }),
    stats: {
      sourceTotal,
      sourceComplete,
      sourceInFlight,
      synced,
      partial,
      openExceptions,
      awaitingSync,
      targetPopulated,
      targetTotal,
      adminMinutesSaved: (synced + partial) * getEstimatedManualMinutesPerJob(),
    },
    seeded: sourceTotal > 0,
  };
}

function sessionView(system: 'JOBLOGIC' | 'CONCERTO') {
  const s = peekSession(system);
  return s ? { username: s.username, expiresAt: s.expiresAt.toISOString() } : null;
}
