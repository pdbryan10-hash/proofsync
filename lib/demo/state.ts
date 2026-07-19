import { prisma } from '@/lib/db/prisma';
import { getManualMinutesPerDirection } from '@/lib/config';
import { sourceJobs, targetWorkOrders, applyStoredTransport, demoControl } from './mongo';
import { peekSession } from './session';
import { timeToNextTick } from './tick';
import {
  getTickSeconds,
  getSourceDbName,
  getTargetDbName,
  getDemoTransport,
  isRemoteBrowser,
  DEMO_SOURCE_LOGIN,
  DEMO_TARGET_LOGIN,
  type DemoTransport,
} from './config';
import { getDemoOrgId } from './org';
import { shotsForSubjects, type ShotSummary } from './screenshots';
import { TARGET_FIELD_LABELS, targetFieldLabel } from '@/lib/domain/field-labels';
import type { SourceJobDoc } from './schema';

/**
 * The console's read model — all three panels in one round trip.
 *
 * Each panel is read from the system that actually owns it: the source panel
 * from DB1, the target panel from DB2, the ledger from ProofSync's own store.
 * Nothing is reconstructed or inferred from one place and presented as three.
 * If DB2 says a field is populated, it is because DB2 was asked.
 */

const PANEL_LIMIT = 45;

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
  /** The paperwork the engineer attached — job sheet, certificates, photos. */
  attachments: { fileName: string; category: string }[];
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

export interface SpotlightData {
  jobNumber: string;
  reference: string;
  description: string;
  site: string;
  engineer: string | null;
  completedAt: string | null;
  documentCount: number;
  /** The completion values that cross into Concerto — real Joblogic data. */
  fields: { label: string; value: string }[];
  /** The two systems ProofSync signs into, for Act 1's sign-in visual. */
  sourceLogin: string;
  targetLogin: string;
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
  /** True when a hosted browser (Browserbase) is configured — enables the toggle. */
  remoteBrowserAvailable: boolean;
  /**
   * A live "watch a real browser sign in" session, if one is running right now.
   * Each URL is a public Browserbase live-view page (no login needed) for one
   * system's tab, so both can be watched signing in side by side. Present only
   * while fresh — it goes away once the session has ended.
   */
  browserProof: {
    joblogicUrl: string | null;
    concertoUrl: string | null;
    sessionId: string;
    at: string;
  } | null;
  /** Closed loop (Work Intake) progress: client-raised jobs round the loop. */
  inbound: { raised: number; dispatched: number; returned: number };
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
  /** One job for Act 1 to walk through — built from source data, always present. */
  spotlight: SpotlightData | null;
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
    /** Totals for the applause screen — real, across the whole batch. */
    fieldsWritten: number;
    certificatesUploaded: number;
    /** ProofSync's own machine time: total across all syncs, and the average. */
    totalSyncMs: number;
    avgSyncMs: number;
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

/** Build the Act 1 walkthrough job from a source completion — no sync required. */
function buildSpotlight(d: SourceJobDoc): SpotlightData {
  const cs = d.completionSheet;
  const mins = d.visit?.minutesOnSite ?? null;
  const fields: { label: string; value: string }[] = [];
  if (cs?.workCarriedOut) fields.push({ label: 'Work completed', value: cs.workCarriedOut });
  if (cs?.engineerComments) fields.push({ label: 'Engineer notes', value: cs.engineerComments });
  if (mins != null) fields.push({ label: 'Time on site', value: `${(mins / 60).toFixed(1)} hours` });
  if (d.completedAt)
    fields.push({
      label: 'Completed',
      value: new Date(d.completedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  if (cs) fields.push({ label: 'Follow-on required', value: cs.followOnRequired ? 'Yes — raised' : 'No' });
  if (d.charges?.totalCharge != null)
    fields.push({ label: 'Cost', value: 'Withheld by client policy' });

  return {
    jobNumber: d.jobNumber,
    reference: d.customerOrderRef ?? '—',
    description: d.description,
    site: d.siteName,
    engineer: d.engineer?.engineerName ?? null,
    completedAt: iso(d.completedAt),
    documentCount: d.attachments?.length ?? 0,
    fields: fields.map((f) => ({ label: f.label, value: previewValue(f.value) })),
    sourceLogin: DEMO_SOURCE_LOGIN.username,
    targetLogin: DEMO_TARGET_LOGIN.username,
  };
}

export async function getDemoState(): Promise<DemoState> {
  // Reflect the presenter's runtime transport choice (see the toggle) in the
  // reported transport and badge.
  await applyStoredTransport();
  // Resolve the org READ-ONLY — never create it here. getDemoState runs on every
  // 1s poll from every open tab; if it created the org, concurrent readers (plus
  // the cron) would each race to create a fresh one, producing DUPLICATE orgs with
  // the same name. Ingest would then write runs into one while the dashboard read
  // another — impossible counts, no visible syncs. Only reset/ingest (both under
  // the beat lock) may create the org.
  const organisationId = await getDemoOrgId();

  const [jobsCol, wosCol] = await Promise.all([sourceJobs(), targetWorkOrders()]);

  const [
    sourceDocs,
    sourceTotal,
    sourceComplete,
    sourceInFlight,
    targetDocsRaw,
    targetTotal,
    runsRaw,
    synced,
    partial,
    openExceptions,
    awaitingSync,
    tick,
    controlDoc,
  ] = await Promise.all([
    jobsCol.find({}).sort({ updatedAt: -1 }).limit(PANEL_LIMIT).toArray(),
    jobsCol.countDocuments({}),
    // Machine-speed KPIs count the OUTBOUND batch only — inbound (closed-loop, JL-97)
    // jobs have their own board, so they mustn't double up the headline figures.
    jobsCol.countDocuments({ status: 'Complete', jobNumber: { $not: /^JL-97/ } }),
    jobsCol.countDocuments({ status: { $in: ['Allocated', 'Travelling', 'On Site'] } }),
    // Foreground work orders ProofSync has actually filled — the proof it crossed —
    // rather than the flood of freshly-raised empty ones, which otherwise dominate
    // by recency and make the client's system look untouched. Inbound (closed-loop)
    // work orders are always included, even before they're filled, so the loop can
    // show the client-raised jobs waiting to be picked up.
    wosCol
      .find({ $or: [{ lastUpdatedBy: { $ne: null } }, { inbound: true }] })
      .sort({ updatedAt: -1 })
      .limit(PANEL_LIMIT)
      .toArray(),
    wosCol.countDocuments({}),
    prisma.syncRun.findMany({
      where: { job: { organisationId } },
      orderBy: { createdAt: 'desc' },
      // Over-fetch, then keep only the latest run per job (below) so the ledger
      // shows ONE row per job — a re-attempt can never surface as a duplicate.
      take: 80,
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
    prisma.job.count({
      where: { organisationId, syncStatus: 'SYNCED', NOT: { joblogicJobId: { startsWith: 'JL-97' } } },
    }),
    prisma.job.count({
      where: { organisationId, syncStatus: 'PARTIAL', NOT: { joblogicJobId: { startsWith: 'JL-97' } } },
    }),
    prisma.exception.count({
      where: {
        job: { organisationId, NOT: { joblogicJobId: { startsWith: 'JL-97' } } },
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
    }),
    prisma.job.count({
      where: {
        organisationId,
        syncStatus: { in: ['PENDING', 'READY', 'SYNCING'] },
        NOT: { joblogicJobId: { startsWith: 'JL-97' } },
      },
    }),
    timeToNextTick(),
    (async () => (await demoControl()).findOne({ _id: 'demo-control' }))(),
  ]);

  // Surface a "watch it sign in" live-view link only while it is genuinely live.
  // A Browserbase session runs a couple of minutes at most, so anything older is
  // stale — the session has ended and the URL would 404.
  const PROOF_FRESH_MS = 3 * 60_000;
  const proofAt = controlDoc?.browserProofAt ? new Date(controlDoc.browserProofAt) : null;
  const jlUrl = controlDoc?.browserProofJoblogicUrl ?? controlDoc?.browserProofLiveUrl ?? null;
  const coUrl = controlDoc?.browserProofConcertoUrl ?? null;
  const browserProof =
    (jlUrl || coUrl) && proofAt && Date.now() - proofAt.getTime() < PROOF_FRESH_MS
      ? {
          joblogicUrl: jlUrl,
          concertoUrl: coUrl,
          sessionId: controlDoc?.browserProofSessionId ?? '',
          at: proofAt.toISOString(),
        }
      : null;

  const targetPopulated = await wosCol.countDocuments({
    // A work order counts as populated once the sync has written anything into it.
    // Batch only — inbound (CON-7) has its own board.
    lastUpdatedBy: { $ne: null },
    reference: { $not: /^CON-7/ },
  });

  // Closed loop (Work Intake) summary: how far the client-raised jobs have got
  // round the loop — raised in Concerto → dispatched into Joblogic → returned and
  // verified back in Concerto.
  const [inboundRaised, inboundDispatched, inboundReturned] = await Promise.all([
    wosCol.countDocuments({
      inbound: true,
      $or: [{ joblogicJobNumber: null }, { joblogicJobNumber: { $exists: false } }],
    }),
    jobsCol.countDocuments({ jobNumber: { $regex: '^JL-97' } }),
    wosCol.countDocuments({ inbound: true, lastUpdatedBy: { $ne: null } }),
  ]);

  // Real batch totals for the applause screen: how many fields ProofSync actually
  // wrote and how many documents it uploaded, across every work order it touched.
  const populatedWos = await wosCol
    .find(
      { lastUpdatedBy: { $ne: null }, reference: { $not: /^CON-7/ } },
      { projection: { attributes: 1, documents: 1 } },
    )
    .toArray();
  const fieldsWritten = populatedWos.reduce(
    (n, w) =>
      n + Object.values(w.attributes ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length,
    0,
  );
  const certificatesUploaded = populatedWos.reduce((n, w) => n + (w.documents?.length ?? 0), 0);

  // ProofSync's own machine time across every completed sync (batch only).
  const syncAgg = await prisma.syncRun.aggregate({
    where: {
      job: { organisationId, NOT: { joblogicJobId: { startsWith: 'JL-97' } } },
      status: { in: ['SUCCESS', 'PARTIAL'] },
      durationMs: { not: null },
    },
    _sum: { durationMs: true },
    _avg: { durationMs: true },
  });
  const totalSyncMs = syncAgg._sum.durationMs ?? 0;
  const avgSyncMs = Math.round(syncAgg._avg.durationMs ?? 0);

  // Backfill the target panel with a few still-empty work orders if there aren't
  // yet enough filled ones — so early on it isn't blank, but filled rows lead.
  // Collapse to the LATEST run per job — the ledger shows one row per job, so a
  // re-attempt (or any accidental double-dispatch) can never appear as a duplicate.
  const seenRunJobs = new Set<string>();
  const runs = runsRaw
    .filter((r) => {
      if (seenRunJobs.has(r.jobId)) return false;
      seenRunJobs.add(r.jobId);
      return true;
    })
    .slice(0, PANEL_LIMIT);

  let targetDocs = targetDocsRaw;
  if (targetDocs.length < PANEL_LIMIT) {
    // Exclude references already shown — inbound raised work orders are now in
    // targetDocsRaw, and without this the empty-backfill would list them twice.
    const have = Array.from(new Set(targetDocs.map((w) => w.reference)));
    const empties = await wosCol
      .find({ lastUpdatedBy: null, reference: { $nin: have } })
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

  // Open exceptions: work orders Concerto still refuses. A work order carries its
  // block from the moment it's seeded, but the exception has NOT HAPPENED until
  // ProofSync actually tries to sync it and Concerto rejects — so only surface the
  // ones whose job is genuinely in EXCEPTION state, not ones still queued. Without
  // this the queue shows the fault before the run even reaches it.
  const raisedExceptionJobs = await prisma.job.findMany({
    where: {
      organisationId,
      exceptions: { some: { status: { in: ['OPEN', 'IN_REVIEW', 'RETRYING'] } } },
    },
    select: { concertoJobReference: true },
  });
  const raisedRefs = new Set(
    raisedExceptionJobs.map((j) => j.concertoJobReference).filter((r): r is string => !!r),
  );
  const blockedWos = (await wosCol.find({ demoBlock: { $ne: null } }).sort({ reference: 1 }).toArray())
    .filter((w) => w.demoBlock && raisedRefs.has(w.reference));
  const blockedRefs = blockedWos.map((w) => w.reference);
  const blockedJobs = blockedRefs.length
    ? await jobsCol.find({ customerOrderRef: { $in: blockedRefs } }).toArray()
    : [];
  const jobByRef = new Map(blockedJobs.map((j) => [j.customerOrderRef, j]));
  const exceptions: ExceptionItem[] = blockedWos.map((w) => ({
    reference: w.reference,
    jobNumber: jobByRef.get(w.reference)?.jobNumber ?? '—',
    summary: w.summary,
    propertyName: w.property?.propertyName ?? '—',
    kind: w.demoBlock!.kind,
    label: w.demoBlock!.label,
    message: w.demoBlock!.message,
    badValue: w.demoBlock!.badValue ?? null,
  }));

  // The Act 1 job: the first clean completed job. Built from SOURCE data, so it is
  // available the instant the batch is seeded and never waits on a sync — Act 1
  // can't hang on "reading…".
  const blockedRefSet = new Set(blockedRefs);
  const spotlightDoc =
    sourceDocs.find(
      (d) => d.status === 'Complete' && d.customerOrderRef && !blockedRefSet.has(d.customerOrderRef),
    ) ??
    sourceDocs.find((d) => d.status === 'Complete') ??
    null;
  const spotlight = spotlightDoc ? buildSpotlight(spotlightDoc) : null;

  // Evidence is keyed by whatever the connector could name at the time — a job
  // number in the source, a work-order reference in the target — so a ledger row
  // collects shots under either of its two identities.
  const shotSubjects = runs.flatMap((r) => [r.job.joblogicJobId, r.job.concertoJobReference ?? '']);
  const shotsBySubject = await shotsForSubjects(shotSubjects.filter(Boolean));

  return {
    transport: getDemoTransport(),
    remoteBrowserAvailable: isRemoteBrowser(),
    browserProof,
    inbound: { raised: inboundRaised, dispatched: inboundDispatched, returned: inboundReturned },
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
      attachments: (d.attachments ?? []).map((a) => ({ fileName: a.fileName, category: a.category })),
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
    spotlight,
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
      adminMinutesSaved: (synced + partial) * getManualMinutesPerDirection(),
      fieldsWritten,
      certificatesUploaded,
      totalSyncMs,
      avgSyncMs,
    },
    seeded: sourceTotal > 0,
  };
}

function sessionView(system: 'JOBLOGIC' | 'CONCERTO') {
  const s = peekSession(system);
  return s ? { username: s.username, expiresAt: s.expiresAt.toISOString() } : null;
}
