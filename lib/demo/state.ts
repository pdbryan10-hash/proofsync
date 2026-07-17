import { prisma } from '@/lib/db/prisma';
import { getEstimatedManualMinutesPerJob } from '@/lib/config';
import { sourceJobs, targetWorkOrders } from './mongo';
import { peekSession } from './session';
import { timeToNextTick } from './tick';
import {
  getTickSeconds,
  getSourceDbName,
  getTargetDbName,
  getDemoTransport,
  type DemoTransport,
} from './config';
import { ensureDemoOrg } from './org';
import { shotsForSubjects, type ShotSummary } from './screenshots';
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
  /** Browser-transport evidence: what was on screen when this run happened. */
  shots: ShotSummary[];
  // The job's own detail + the fields this run actually wrote into the client's
  // work order, carried on the ledger row so a consumer (the Act 1 spotlight) can
  // show one job's whole journey without depending on the target panel's window.
  summary: string;
  propertyName: string;
  engineerName: string | null;
  jobCompletedAt: string | null;
  documentCount: number;
  targetFields: { field: string; label: string; preview: string }[];
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

export interface ExceptionItem {
  reference: string;
  jobNumber: string;
  summary: string;
  propertyName: string;
  kind: 'MISSING_FIELD' | 'INVALID_VALUE';
  label: string;
  message: string;
  /** For INVALID_VALUE: the current garbled value, to pre-fill the correction. */
  badValue: string | null;
}

export interface DemoState {
  transport: DemoTransport;
  databases: { source: string; target: string; ledger: string };
  /** Where the stand-in systems' own UIs live, so the console can link to them. */
  systemUrls: { source: string; target: string };
  tick: { lastTickAt: string | null; nextTickInMs: number; tickCount: number; tickSeconds: number };
  sessions: {
    joblogic: { username: string; expiresAt: string } | null;
    concerto: { username: string; expiresAt: string } | null;
  };
  source: SourceRow[];
  ledger: LedgerRow[];
  target: TargetRow[];
  /** Jobs Concerto refused, waiting for a person to correct and resubmit. */
  exceptions: ExceptionItem[];
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
    targetDocsRaw,
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
    // Foreground work orders ProofSync has actually filled — the proof it crossed —
    // rather than the flood of freshly-raised empty ones, which otherwise dominate
    // by recency and make the client's system look untouched.
    wosCol.find({ lastUpdatedBy: { $ne: null } }).sort({ updatedAt: -1 }).limit(PANEL_LIMIT).toArray(),
    wosCol.countDocuments({}),
    prisma.syncRun.findMany({
      where: { job: { organisationId } },
      orderBy: { createdAt: 'desc' },
      take: PANEL_LIMIT,
      include: {
        job: {
          select: {
            joblogicJobId: true,
            concertoJobReference: true,
            jobDescription: true,
            siteName: true,
            engineerName: true,
            completedAt: true,
          },
        },
      },
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

  // Backfill the target panel with a few still-empty work orders if there aren't
  // yet enough filled ones — so early on it isn't blank, but filled rows lead.
  let targetDocs = targetDocsRaw;
  if (targetDocs.length < PANEL_LIMIT) {
    const empties = await wosCol
      .find({ lastUpdatedBy: null })
      .sort({ updatedAt: -1 })
      .limit(PANEL_LIMIT - targetDocs.length)
      .toArray();
    targetDocs = [...targetDocs, ...empties];
  }

  // Pull the work orders the ledger rows point at (by reference, regardless of the
  // target panel's window) so each ledger row can carry the real fields it wrote.
  const ledgerRefs = Array.from(
    new Set(runs.map((r) => r.job.concertoJobReference).filter((x): x is string => !!x)),
  );
  const ledgerWos = ledgerRefs.length
    ? await wosCol.find({ reference: { $in: ledgerRefs } }).toArray()
    : [];
  const woByRef = new Map(ledgerWos.map((w) => [w.reference, w]));

  // Open exceptions: work orders Concerto still refuses, each waiting for a
  // person. Joined back to the source job for a human-readable label.
  const blockedWos = await wosCol.find({ demoBlock: { $ne: null } }).sort({ reference: 1 }).toArray();
  const blockedRefs = blockedWos.map((w) => w.reference);
  const blockedJobs = blockedRefs.length
    ? await jobsCol.find({ customerOrderRef: { $in: blockedRefs } }).toArray()
    : [];
  const jobByRef = new Map(blockedJobs.map((j) => [j.customerOrderRef, j]));
  const exceptions: ExceptionItem[] = blockedWos
    .filter((w) => w.demoBlock)
    .map((w) => ({
      reference: w.reference,
      jobNumber: jobByRef.get(w.reference)?.jobNumber ?? '—',
      summary: w.summary,
      propertyName: w.property?.propertyName ?? '—',
      kind: w.demoBlock!.kind,
      label: w.demoBlock!.label,
      message: w.demoBlock!.message,
      badValue: w.demoBlock!.badValue ?? null,
    }));

  // Evidence is keyed by whatever the connector could name at the time — a job
  // number in the source, a work-order reference in the target — so a ledger row
  // collects shots under either of its two identities.
  const shotSubjects = runs.flatMap((r) => [r.job.joblogicJobId, r.job.concertoJobReference ?? '']);
  const shotsBySubject = await shotsForSubjects(shotSubjects.filter(Boolean));

  return {
    transport: getDemoTransport(),
    databases: {
      source: getSourceDbName(),
      target: getTargetDbName(),
      ledger: 'see_cafm_sync',
    },
    systemUrls: {
      source: '/systems/joblogic/jobs',
      target: '/systems/concerto/work-orders',
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
    ledger: runs.map((r) => {
      const wo = r.job.concertoJobReference ? woByRef.get(r.job.concertoJobReference) : undefined;
      const woAttrs = wo?.attributes ?? {};
      const targetFields = Object.entries(woAttrs)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([field, v]) => ({ field, label: targetFieldLabel(field), preview: previewValue(v) }));
      return {
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
        shots: [
          ...(shotsBySubject[r.job.joblogicJobId] ?? []),
          ...(r.job.concertoJobReference ? shotsBySubject[r.job.concertoJobReference] ?? [] : []),
        ].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
        summary: wo?.summary ?? r.job.jobDescription ?? '—',
        propertyName: wo?.property?.propertyName ?? r.job.siteName ?? '—',
        engineerName: r.job.engineerName ?? null,
        jobCompletedAt: iso(r.job.completedAt),
        documentCount: wo?.documents?.length ?? r.documentsTransferred ?? 0,
        targetFields,
      };
    }),
    exceptions,
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
