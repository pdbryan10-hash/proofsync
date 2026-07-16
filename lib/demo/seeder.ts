import { sourceJobs, sourceUsers, targetWorkOrders, targetUsers, demoControl, ensureDemoIndexes } from './mongo';
import { DEMO_SOURCE_LOGIN, DEMO_TARGET_LOGIN } from './config';
import type { SourceJobDoc, SourceAttachmentDoc, TargetWorkOrderDoc } from './schema';

/**
 * Drives the two stand-in systems.
 *
 * The source system runs a real job lifecycle — Allocated → Travelling → On Site
 * → Complete — rather than spawning finished work. That matters: a viewer sees a
 * job sitting in Joblogic that ProofSync deliberately ignores, watches the
 * engineer complete it, and only then sees it cross. "It only moves completed
 * work" is demonstrated instead of asserted.
 *
 * Faults are seeded at realistic rates (see FAULT_RATES). A demo where
 * everything succeeds proves nothing about what happens when it doesn't, and the
 * exception paths are the part a client actually cares about.
 */

const SITES = [
  { siteName: 'Northgate Shopping Centre — Leeds', siteAddress: 'Briggate, Leeds LS1 6BR' },
  { siteName: 'Northgate Retail Park — Derby', siteAddress: 'Meteor Centre, Derby DE21 4ST' },
  { siteName: 'Northgate Retail Park — Warrington', siteAddress: 'Westbrook Centre, Warrington WA5 8UD' },
  { siteName: 'Northgate Shopping Centre — Chesterfield', siteAddress: 'Vicar Lane, Chesterfield S40 1PY' },
  { siteName: 'Northgate Retail Park — Stoke', siteAddress: 'Festival Park, Stoke-on-Trent ST1 5NZ' },
  { siteName: 'Northgate Centre — Doncaster', siteAddress: 'Frenchgate, Doncaster DN1 1SW' },
  { siteName: 'Northgate Retail Park — Wakefield', siteAddress: 'Westgate Retail Park, Wakefield WF2 9SH' },
];

const WORK_TYPES = [
  {
    description: 'Emergency lighting — monthly flick test and certification',
    asset: 'EML',
    work: 'Completed monthly flick test across all emergency luminaires. Two units failed to hold charge and were replaced.',
    notes: 'Units at fire exit 3 and loading bay showed degraded batteries — replaced with like-for-like. All units now holding the full 3-hour duration.',
    docs: ['Test Certificate', 'Service Sheet'],
    minutes: [55, 110],
    labour: [95, 180],
    materials: [0, 140],
  },
  {
    description: 'AHU 02 — quarterly service and belt replacement',
    asset: 'AHU',
    work: 'Quarterly service completed. Drive belt replaced, bearings greased, filters inspected and unit returned to service.',
    notes: 'Belt showed significant glazing and was replaced ahead of failure. Recommend moving this unit to a 3-month belt inspection.',
    docs: ['Service Report', 'Site Photo'],
    minutes: [90, 180],
    labour: [140, 260],
    materials: [35, 190],
  },
  {
    description: 'Gas boiler — annual service and safety check',
    asset: 'BLR',
    work: 'Annual service carried out. Combustion analysis within tolerance, seals and heat exchanger inspected, gas safety certificate issued.',
    notes: 'Flue gas readings good. Case seal starting to perish — flagged for next visit, no immediate safety concern.',
    docs: ['Gas Safety Certificate', 'Service Sheet'],
    minutes: [75, 150],
    labour: [130, 240],
    materials: [0, 85],
  },
  {
    description: 'Roller shutter door — reactive call, will not close',
    asset: 'DOR',
    work: 'Attended reactive fault. Safety edge sensor misaligned and obstructing close cycle. Realigned, tested through 10 full cycles.',
    notes: 'Sensor bracket had been knocked, most likely by a delivery vehicle. Suggest a bollard to protect the bracket.',
    docs: ['Service Sheet', 'Site Photo'],
    minutes: [45, 120],
    labour: [110, 210],
    materials: [0, 60],
  },
  {
    description: 'Fire alarm panel — zone 4 fault investigation',
    asset: 'FAP',
    work: 'Investigated persistent zone 4 fault. Traced to a water-ingress-damaged detector in the service corridor. Detector replaced, zone tested and cleared.',
    notes: 'Water ingress appears to be from the roof above the corridor — fabric issue, raised as follow-on for the landlord.',
    docs: ['Test Certificate', 'Service Report'],
    minutes: [60, 165],
    labour: [120, 250],
    materials: [40, 130],
    followOnLikely: true,
  },
  {
    description: 'Water hygiene — TMV servicing and temperature monitoring',
    asset: 'TMV',
    work: 'Serviced all thermostatic mixing valves and recorded sentinel outlet temperatures. All within ACOP L8 tolerance after adjustment.',
    notes: 'Two TMVs required adjustment to bring the blend temperature back inside range. All outlets now compliant.',
    docs: ['Compliance Record', 'Service Sheet'],
    minutes: [80, 170],
    labour: [125, 230],
    materials: [0, 75],
  },
  {
    description: 'HVAC — filter change and coil clean, units 1–4',
    asset: 'HVC',
    work: 'Replaced primary and secondary filters on units 1–4 and cleaned condenser coils. Airflow readings restored to design spec.',
    notes: 'Unit 3 coil was heavily fouled and needed a second pass. Recommend shortening the clean interval on that unit.',
    docs: ['Service Report'],
    minutes: [100, 200],
    labour: [150, 280],
    materials: [60, 210],
  },
  {
    description: 'Leaking WC cistern — customer toilets, ground floor',
    asset: 'PLM',
    work: 'Isolated and replaced failed inlet valve on cistern 3. Tested for leaks over 20 minutes, no further weeping.',
    notes: 'Cistern internals were the original fit and are at end of life across this block — worth a planned replacement.',
    docs: ['Service Sheet'],
    minutes: [35, 90],
    labour: [80, 160],
    materials: [15, 70],
  },
];

const ENGINEERS = [
  { engineerId: 'ENG-114', engineerName: 'D. Whitaker' },
  { engineerId: 'ENG-207', engineerName: 'S. Nkemelu' },
  { engineerId: 'ENG-233', engineerName: 'R. Kaur' },
  { engineerId: 'ENG-318', engineerName: 'M. Okonkwo' },
  { engineerId: 'ENG-402', engineerName: 'J. Hollis' },
  { engineerId: 'ENG-455', engineerName: 'A. Petrescu' },
];

/**
 * Seeded fault rates.
 *
 * Tuned DOWN for a clean demo recording: the success path should dominate, with
 * one instructive exception type (a missing client reference — "it refuses to
 * guess") showing up occasionally rather than six different failures at once,
 * which reads as chaos instead of control. Override any of them by env, e.g.
 * DEMO_FAULT_MISSING_REF=0.2, to dial the drama up for a specific audience.
 */
function faultRate(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey]);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : fallback;
}

const FAULT_RATES = {
  /** Engineer left the client's order reference blank. The one we keep visible. */
  missingReference: faultRate('DEMO_FAULT_MISSING_REF', 0.08),
  /** Reference typed in a format Concerto never issues. */
  malformedReference: faultRate('DEMO_FAULT_MALFORMED_REF', 0.03),
  /** Reference looks right but no such work order exists in the client's system. */
  targetNotFound: faultRate('DEMO_FAULT_TARGET_MISSING', 0.02),
  /** Concerto rejects the first write with a 503. Rare — it reads as FAILED
   *  until an operator retries, so a little goes a long way on camera. */
  transientTargetOutage: faultRate('DEMO_FAULT_OUTAGE', 0.03),
  /** One attachment is rejected — core data syncs, document doesn't (PARTIAL). */
  documentRejected: faultRate('DEMO_FAULT_DOC_REJECT', 0.04),
};

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const between = ([lo, hi]: number[]): number => Math.round(lo! + Math.random() * (hi! - lo!));
const chance = (p: number): boolean => Math.random() < p;

const CONTROL_ID = 'demo-control';

async function nextSequence(count = 1): Promise<number> {
  const control = await demoControl();
  const doc = await control.findOneAndUpdate(
    { _id: CONTROL_ID },
    { $inc: { jobSequence: count } },
    { upsert: true, returnDocument: 'after' },
  );
  const after = doc?.jobSequence ?? count;
  return after - count; // first value of the reserved block
}

// --- Seeding ----------------------------------------------------------------

/**
 * Wipe both stand-in systems and lay down a starting state.
 *
 * The baseline deliberately includes work at every stage, so the console has
 * something to show on the first frame and something to complete on the first
 * beat — rather than an empty screen for the first 30 seconds.
 */
export async function seedDemoSystems(): Promise<{ jobs: number; workOrders: number }> {
  const [jobs, users, wos, tUsers, control] = await Promise.all([
    sourceJobs(),
    sourceUsers(),
    targetWorkOrders(),
    targetUsers(),
    demoControl(),
  ]);

  await Promise.all([
    jobs.deleteMany({}),
    users.deleteMany({}),
    wos.deleteMany({}),
    tUsers.deleteMany({}),
    control.deleteMany({}),
  ]);

  await ensureDemoIndexes();

  // The fake logins each system knows about.
  await users.insertOne({
    username: DEMO_SOURCE_LOGIN.username,
    password: DEMO_SOURCE_LOGIN.password,
    displayName: 'ProofSync Integration',
    role: 'Integration User',
    lastLoginAt: null,
  });
  await tUsers.insertOne({
    username: DEMO_TARGET_LOGIN.username,
    password: DEMO_TARGET_LOGIN.password,
    displayName: 'ProofSync Service Account',
    role: 'Contractor Update',
    lastLoginAt: null,
  });

  await control.insertOne({
    _id: CONTROL_ID,
    lastTickAt: null,
    tickCount: 0,
    jobSequence: 0,
    seededAt: new Date(),
  });

  // Baseline: four already complete (first beat has real work), five mid-flight
  // (they visibly progress), three freshly allocated (the pipe keeps filling).
  const created: SourceJobDoc[] = [];
  created.push(...(await createJobs(4, 'Complete')));
  created.push(...(await createJobs(5, 'On Site')));
  created.push(...(await createJobs(3, 'Allocated')));

  return { jobs: created.length, workOrders: await wos.countDocuments({}) };
}

/**
 * Create jobs in the source system at a given lifecycle stage, raising the
 * matching work order in the client's system as the client would have done.
 */
async function createJobs(count: number, stage: SourceJobDoc['status']): Promise<SourceJobDoc[]> {
  if (count <= 0) return [];
  const jobs = await sourceJobs();
  const wos = await targetWorkOrders();
  const startSeq = await nextSequence(count);

  const jobDocs: SourceJobDoc[] = [];
  const woDocs: TargetWorkOrderDoc[] = [];

  for (let i = 0; i < count; i++) {
    const seq = startSeq + i + 1;
    const site = pick(SITES);
    const type = pick(WORK_TYPES);
    const now = new Date();

    const jobNumber = `JL-${100000 + seq}`;
    const referenceNumber = 280000 + seq * 7;
    const trueReference = `CON-${referenceNumber}`;

    // Decide this job's fate up front so the source data itself carries the
    // fault — the engine is never told, it has to find out.
    const missingRef = chance(FAULT_RATES.missingReference);
    const malformedRef = !missingRef && chance(FAULT_RATES.malformedReference);
    const targetMissing = !missingRef && !malformedRef && chance(FAULT_RATES.targetNotFound);

    const customerOrderRef = missingRef
      ? null
      : malformedRef
        ? // Formats an engineer plausibly types that Concerto never issues.
          pick([`CON ${referenceNumber}`, `${referenceNumber}`, `CON-${referenceNumber}-A`])
        : trueReference;

    const attachments = buildAttachments(type.docs, seq);

    const scheduledDate = new Date(now.getTime() - between([20, 260]) * 60_000);
    const job: SourceJobDoc = {
      jobNumber,
      customerOrderRef,
      siteName: site.siteName,
      siteAddress: site.siteAddress,
      assetRef: `${site.siteName.split('—')[1]?.trim().slice(0, 3).toUpperCase() ?? 'NGT'}-${type.asset}-${String(seq % 9 + 1).padStart(2, '0')}`,
      description: type.description,
      engineer: pick(ENGINEERS),
      status: stage,
      scheduledDate,
      completedAt: null,
      visit: null,
      completionSheet: null,
      charges: null,
      attachments,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    if (stage === 'On Site') {
      job.visit = { arrivedAt: new Date(now.getTime() - between([10, 70]) * 60_000), departedAt: null, minutesOnSite: null };
    }
    if (stage === 'Complete') {
      applyCompletion(job, type);
    }

    jobDocs.push(job);

    // The client raised the work order — unless this job is the "reference
    // points at nothing" case, where there is deliberately no target record.
    if (!targetMissing) {
      woDocs.push({
        reference: trueReference,
        status: 'Awaiting Contractor',
        property: { propertyName: site.siteName, propertyAddress: site.siteAddress },
        assetId: job.assetRef,
        summary: type.description,
        // Starts empty: this is precisely what a client's CAFM looks like while
        // it waits for someone to re-key the contractor's paperwork into it.
        attributes: {},
        documents: [],
        lastUpdatedBy: null,
        simulateUpdateFailure: chance(FAULT_RATES.transientTargetOutage),
        createdAt: new Date(now.getTime() - between([60, 2880]) * 60_000),
        updatedAt: now,
      });
    }
  }

  if (jobDocs.length) await jobs.insertMany(jobDocs);
  if (woDocs.length) await wos.insertMany(woDocs);
  return jobDocs;
}

function buildAttachments(categories: string[], seq: number): SourceAttachmentDoc[] {
  const rejectIndex = chance(FAULT_RATES.documentRejected) ? Math.floor(Math.random() * categories.length) : -1;
  return categories.map((category, i) => ({
    attachmentId: `JL-ATT-${100000 + seq}-${i + 1}`,
    fileName: `${category.replace(/\s+/g, '-').toLowerCase()}-${100000 + seq}.pdf`,
    contentType: 'application/pdf',
    category,
    bytes: between([48_000, 2_400_000]),
    rejectOnUpload: i === rejectIndex,
  }));
}

/** Fill in the completion sheet — what the engineer does before leaving site. */
function applyCompletion(job: SourceJobDoc, type: (typeof WORK_TYPES)[number]): void {
  const minutes = between(type.minutes);
  const arrivedAt = job.visit?.arrivedAt ?? new Date(Date.now() - (minutes + between([5, 40])) * 60_000);
  const departedAt = new Date(arrivedAt.getTime() + minutes * 60_000);
  const labour = between(type.labour);
  const materials = between(type.materials);
  const followOn = type.followOnLikely ? chance(0.7) : chance(0.15);

  job.status = 'Complete';
  job.completedAt = departedAt;
  job.visit = { arrivedAt, departedAt, minutesOnSite: minutes };
  job.completionSheet = {
    workCarriedOut: type.work,
    engineerComments: type.notes,
    followOnRequired: followOn,
    followOnDetail: followOn ? 'Follow-on quote required — raised with the account manager.' : null,
  };
  job.charges = {
    labourCharge: labour,
    materialsCharge: materials,
    totalCharge: labour + materials,
  };
  job.updatedAt = new Date();
}

// --- The drip ---------------------------------------------------------------

export interface DripResult {
  progressed: number;
  completed: number;
  created: number;
  completedJobNumbers: string[];
}

/**
 * One beat of source-system activity: engineers move along, some finish, and new
 * work lands. Called by the tick before ingest, so each beat has fresh work to
 * find — which is what makes the console look alive rather than replayed.
 */
export async function dripSourceActivity(maxNew: number): Promise<DripResult> {
  const jobs = await sourceJobs();
  const result: DripResult = { progressed: 0, completed: 0, created: 0, completedJobNumbers: [] };

  // 1. Allocated → Travelling → On Site.
  for (const [from, to] of [['Allocated', 'Travelling'], ['Travelling', 'On Site']] as const) {
    const candidates = await jobs.find({ status: from }).limit(2).toArray();
    for (const job of candidates) {
      if (!chance(0.6)) continue;
      const patch: Partial<SourceJobDoc> = { status: to, updatedAt: new Date() };
      if (to === 'On Site') patch.visit = { arrivedAt: new Date(), departedAt: null, minutesOnSite: null };
      await jobs.updateOne({ jobNumber: job.jobNumber }, { $set: patch });
      result.progressed += 1;
    }
  }

  // 2. Some on-site jobs finish. This is the moment that matters: the record
  //    becomes syncable, and the next stage of this same tick will move it.
  const onSite = await jobs.find({ status: 'On Site' }).limit(3).toArray();
  for (const job of onSite) {
    if (!chance(0.55)) continue;
    const type = WORK_TYPES.find((t) => t.description === job.description) ?? WORK_TYPES[0]!;
    applyCompletion(job, type);
    await jobs.updateOne(
      { jobNumber: job.jobNumber },
      {
        $set: {
          status: 'Complete',
          completedAt: job.completedAt,
          visit: job.visit,
          completionSheet: job.completionSheet,
          charges: job.charges,
          updatedAt: new Date(),
        },
        // A completed sheet is a new revision — this is what the idempotency key
        // is built from, so an edited sheet re-syncs and an unchanged one does not.
        $inc: { revision: 1 },
      },
    );
    result.completed += 1;
    result.completedJobNumbers.push(job.jobNumber);
  }

  // 3. Keep the pipe full.
  const newCount = Math.min(maxNew, Math.random() < 0.35 ? 0 : between([1, Math.max(1, maxNew)]));
  if (newCount > 0) {
    const created = await createJobs(newCount, 'Allocated');
    result.created = created.length;
  }

  return result;
}
