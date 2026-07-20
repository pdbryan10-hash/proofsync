import { sourceJobs, sourceUsers, targetWorkOrders, targetUsers, demoControl, ensureDemoIndexes } from './mongo';
import { DEMO_SOURCE_LOGIN, DEMO_TARGET_LOGIN } from './config';
import type { SourceJobDoc, SourceAttachmentDoc, TargetWorkOrderDoc, TargetWorkOrderBlock } from './schema';

/**
 * Seeds the two stand-in systems with ONE fixed batch of work.
 *
 * The demo is deliberately not a perpetual motion machine: "Start over" lays
 * down the same deterministic set of completed jobs every time, ProofSync runs
 * it end to end once, and the result is the result. There is no drip, no burst
 * and no trim — nothing is created or destroyed after the seed, so no counter
 * can drift on its own and every exception stays put until a person clears it.
 *
 * Most jobs sync cleanly. A fixed few are set up to fail in ONE honest, human-
 * resolvable way: the client's system (Concerto) refuses the save until a field
 * it mandates — a cost centre Joblogic never captured — is supplied. That job
 * sits in "needs a person" until someone provides the value and resubmits.
 */

const SITES = [
  { siteName: 'Meridian Retail — Leeds', siteAddress: 'Briggate, Leeds LS1 6BR' },
  { siteName: 'Crowngate Centre — Derby', siteAddress: 'Meteor Centre, Derby DE21 4ST' },
  { siteName: 'Apex Facilities — Warrington', siteAddress: 'Westbrook Centre, Warrington WA5 8UD' },
  { siteName: 'Kingsway Shopping — Chesterfield', siteAddress: 'Vicar Lane, Chesterfield S40 1PY' },
  { siteName: 'Harbourside Estate — Stoke', siteAddress: 'Festival Park, Stoke-on-Trent ST1 5NZ' },
  { siteName: 'Parkview Centre — Doncaster', siteAddress: 'Frenchgate, Doncaster DN1 1SW' },
  { siteName: 'Riverside Retail — Wakefield', siteAddress: 'Westgate Retail Park, Wakefield WF2 9SH' },
  { siteName: 'Bramwell Group — Sheffield', siteAddress: 'The Moor, Sheffield S1 4PF' },
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
    description: 'Fixed wire testing — EICR remedial works',
    asset: 'DB',
    work: 'Completed remedial works from the EICR: two C2 observations rectified, a damaged socket replaced, and the affected circuits re-tested to BS 7671.',
    notes: 'Both C2s were loose terminations at the distribution board. Board now clear; a satisfactory EICR can be issued at the next inspection.',
    docs: ['Test Certificate', 'Service Report'],
    minutes: [90, 200],
    labour: [150, 290],
    materials: [20, 120],
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
    description: 'Washroom deep clean — ground-floor customer WCs',
    asset: 'CLN',
    work: 'Full deep clean of the ground-floor washrooms: sanitised all fittings, descaled the urinals, cleaned tiling and grout, and restocked consumables.',
    notes: 'Grout in the gents was heavily stained and needed a second treatment. Recommend a periodic deep clean on this block every quarter.',
    docs: ['Service Sheet', 'Site Photo'],
    minutes: [60, 130],
    labour: [70, 150],
    materials: [10, 60],
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
  {
    description: 'Distribution board — RCD tripping intermittently',
    asset: 'DB',
    work: 'Investigated nuisance tripping on the sub-main RCD. Traced to a failing immersion element leaking to earth; isolated the circuit and replaced the element.',
    notes: 'RCD held under the full site load after the repair, with no further tripping across a 40-minute soak test.',
    docs: ['Test Certificate'],
    minutes: [60, 150],
    labour: [120, 240],
    materials: [30, 110],
  },
  {
    description: 'Warm-air heater — no ignition on the sales floor',
    asset: 'GAS',
    work: 'Attended no-heat call. Cleaned and reset the ignition electrode and flame sensor, checked gas pressure, and returned the unit to service.',
    notes: 'Electrode was sooted up; unit now firing reliably over ten test cycles. Flagged the flame sensor for replacement at the annual service.',
    docs: ['Gas Safety Certificate', 'Service Sheet'],
    minutes: [50, 130],
    labour: [110, 220],
    materials: [0, 70],
    followOnLikely: true,
  },
  {
    description: 'Blocked drainage — car park gully overflowing',
    asset: 'DRN',
    work: 'Cleared the blocked surface-water gully and connecting run with rods and a jetter. CCTV confirmed the line runs clear through to the interceptor.',
    notes: 'Blockage was silt and leaf litter. Recommend the car-park gullies go on a scheduled clean ahead of winter.',
    docs: ['Service Report', 'Site Photo'],
    minutes: [45, 120],
    labour: [95, 190],
    materials: [0, 40],
  },
  {
    description: 'Fire extinguishers — annual service and recharge',
    asset: 'FEX',
    work: 'Completed the annual service across all extinguishers on site. Two units recharged, one condemned and replaced, all tagged and certificated.',
    notes: 'The condemned CO2 unit was past its hydraulic test date. Replacement fitted and logged on the asset register.',
    docs: ['Test Certificate', 'Compliance Record'],
    minutes: [55, 120],
    labour: [90, 170],
    materials: [20, 130],
  },
  {
    description: 'Building fabric — ceiling tiles and fire door repair',
    asset: 'FAB',
    work: 'Replaced water-stained ceiling tiles in the mall and re-hung a dropped fire door, adjusting the closer to achieve correct latching.',
    notes: 'Ceiling staining is historic from the earlier roof leak, now dry. Fire door closes and latches correctly under the self-close test.',
    docs: ['Service Sheet', 'Site Photo'],
    minutes: [70, 160],
    labour: [110, 220],
    materials: [25, 140],
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

const CONTROL_ID = 'demo-control';

/** The old machine-speed batch (JL-1xx). The demo is closed-loop only now, so it's
 *  never shown — and seeding it "completed" made the background tick sync it,
 *  polluting the dashboard with 20 jobs nobody ran. Zero it out. */
const BATCH_SIZE = 0;
/** Jobs the client has raised in Concerto for Work Intake to pull into Joblogic. */
const INBOUND_BATCH_SIZE = 20;
/** Concerto attribute the cost-centre exceptions write to. */
export const COST_CENTRE_ATTR = 'clientCostCentre';

/**
 * The fixed exception(s) — kept to a single, resolvable one so the batch runs
 * quickly and the "needs a person" moment is clear. Keyed by batch index; every
 * other job syncs cleanly.
 */
const COST_CENTRE_BLOCK: TargetWorkOrderBlock = {
  kind: 'MISSING_FIELD',
  label: 'Cost centre',
  message: 'Cost centre is required for this contract before the work order can be updated.',
  attribute: COST_CENTRE_ATTR,
};
const GARBLED_BLOCK: TargetWorkOrderBlock = {
  kind: 'INVALID_VALUE',
  label: 'Completion notes',
  message: "Concerto rejected the update — the completion notes contain characters its validation won't accept.",
  sourceField: 'engineerComments',
  badValue: 'Job done â€” see attached ??? notes Ã¢â‚¬™ (encoding lost on the app)',
};
// Two exceptions spread across the 20-job batch so the "needs a person" moment is
// visible as the jobs pass — one missing field, one garbled text.
const BLOCKS: Record<number, TargetWorkOrderBlock> = {
  5: COST_CENTRE_BLOCK,
  14: GARBLED_BLOCK,
};
/** The same two, for the inbound (closed-loop) batch. */
const INBOUND_BLOCKS: Record<number, TargetWorkOrderBlock> = {
  4: COST_CENTRE_BLOCK,
  13: GARBLED_BLOCK,
};
/** Jobs whose site photo Concerto rejects — core data syncs, document doesn't (PARTIAL). */
const DOCUMENT_REJECTED = new Set<number>();

// A fixed spread of minutes-ago so the batch reads like a real morning's work,
// deterministic so every reset is identical.
const between = ([lo, hi]: number[]): number => Math.round((lo! + hi!) / 2);

// --- Seeding ----------------------------------------------------------------

export async function seedDemoSystems(): Promise<{ jobs: number; workOrders: number }> {
  const [jobs, users, wos, tUsers, control] = await Promise.all([
    sourceJobs(),
    sourceUsers(),
    targetWorkOrders(),
    targetUsers(),
    demoControl(),
  ]);

  // Advance the org epoch so this reseed points ProofSync's ledger at a FRESH
  // organisation — nothing to delete there, so reset stays instant and can't
  // race the relation checks. The previous org is simply abandoned.
  const prevControl = await control.findOne({ _id: CONTROL_ID });
  const nextEpoch = (prevControl?.orgEpoch ?? 0) + 1;

  await Promise.all([
    jobs.deleteMany({}),
    users.deleteMany({}),
    wos.deleteMany({}),
    tUsers.deleteMany({}),
    control.deleteMany({}),
  ]);

  await ensureDemoIndexes();

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
    jobSequence: BATCH_SIZE,
    seededAt: new Date(),
    orgEpoch: nextEpoch,
  });

  const jobDocs: SourceJobDoc[] = [];
  const woDocs: TargetWorkOrderDoc[] = [];
  const now = Date.now();

  for (let i = 0; i < BATCH_SIZE; i++) {
    const site = SITES[i % SITES.length]!;
    const type = WORK_TYPES[i % WORK_TYPES.length]!;
    const engineer = ENGINEERS[i % ENGINEERS.length]!;

    const jobNumber = `JL-${100001 + i}`;
    const reference = `CON-${280000 + (i + 1) * 7}`;

    // Every job carries its client reference (it's captured in Joblogic on site);
    // matching is never the failure here.
    const completedMinsAgo = 8 + i * 6;
    const completedAt = new Date(now - completedMinsAgo * 60_000);
    const arrivedAt = new Date(completedAt.getTime() - between(type.minutes) * 60_000);

    const rejectDoc = DOCUMENT_REJECTED.has(i);
    const attachments = buildAttachments(type.docs, i, rejectDoc);

    const job: SourceJobDoc = {
      jobNumber,
      customerOrderRef: reference,
      siteName: site.siteName,
      siteAddress: site.siteAddress,
      assetRef: `${site.siteName.split('—')[1]?.trim().slice(0, 3).toUpperCase() ?? 'NGT'}-${type.asset}-${String((i % 9) + 1).padStart(2, '0')}`,
      description: type.description,
      engineer,
      status: 'Complete',
      scheduledDate: new Date(arrivedAt.getTime() - 30 * 60_000),
      completedAt,
      visit: { arrivedAt, departedAt: completedAt, minutesOnSite: between(type.minutes) },
      completionSheet: null,
      charges: null,
      attachments,
      revision: 1,
      createdAt: completedAt,
      updatedAt: completedAt,
    };
    applyCompletion(job, type, completedAt);

    const block = BLOCKS[i] ?? null;
    // For a garbled-value exception, the SOURCE really carries the bad text — the
    // demo doesn't fake the fault, it plants it where a real one would live.
    if (block?.kind === 'INVALID_VALUE' && block.sourceField && job.completionSheet) {
      job.completionSheet[block.sourceField] = block.badValue ?? '';
    }
    jobDocs.push(job);

    woDocs.push({
      reference,
      status: 'Awaiting Contractor',
      property: { propertyName: site.siteName, propertyAddress: site.siteAddress },
      assetId: job.assetRef,
      summary: type.description,
      attributes: {},
      documents: [],
      lastUpdatedBy: null,
      demoBlock: block,
      createdAt: new Date(completedAt.getTime() - 6 * 60 * 60_000),
      updatedAt: completedAt,
    });
  }

  // INBOUND (closed loop): a handful of jobs the client has just RAISED in
  // Concerto, with no Joblogic job yet. Work Intake polls these off Concerto and
  // creates the matching Joblogic job. They carry `inbound: true` and no
  // joblogicJobNumber, so the intake engine can find the un-picked-up ones.
  for (let i = 0; i < INBOUND_BATCH_SIZE; i++) {
    const site = SITES[(i + 2) % SITES.length]!;
    const type = WORK_TYPES[(i + 5) % WORK_TYPES.length]!;
    const reference = `CON-${70001 + i}`;
    const raisedAt = new Date(now - (i + 1) * 14 * 60_000);
    woDocs.push({
      reference,
      status: 'Awaiting Contractor',
      property: { propertyName: site.siteName, propertyAddress: site.siteAddress },
      assetId: `${site.siteName.split('—')[1]?.trim().slice(0, 3).toUpperCase() ?? 'NGT'}-${type.asset}-${String((i % 9) + 1).padStart(2, '0')}`,
      summary: type.description,
      attributes: {},
      documents: [],
      lastUpdatedBy: null,
      demoBlock: INBOUND_BLOCKS[i] ?? null,
      inbound: true,
      joblogicJobNumber: null,
      createdAt: raisedAt,
      updatedAt: raisedAt,
    });
  }

  // jobDocs is empty now the machine batch is zeroed (inbound source jobs are
  // created later by Work Intake); insertMany([]) would throw.
  if (jobDocs.length > 0) await jobs.insertMany(jobDocs);
  if (woDocs.length > 0) await wos.insertMany(woDocs);

  return { jobs: jobDocs.length, workOrders: woDocs.length };
}

function buildAttachments(categories: string[], i: number, rejectDoc: boolean): SourceAttachmentDoc[] {
  // Deterministically reject the LAST attachment of the flagged job.
  const rejectIndex = rejectDoc ? categories.length - 1 : -1;
  return categories.map((category, idx) => ({
    attachmentId: `JL-ATT-${100001 + i}-${idx + 1}`,
    fileName: `${category.replace(/\s+/g, '-').toLowerCase()}-${100001 + i}.pdf`,
    contentType: 'application/pdf',
    category,
    bytes: 120_000 + idx * 40_000 + i * 1_000,
    rejectOnUpload: idx === rejectIndex,
  }));
}

/** Fill in the completion sheet — what the engineer records before leaving site. */
function applyCompletion(job: SourceJobDoc, type: (typeof WORK_TYPES)[number], completedAt: Date): void {
  const minutes = between(type.minutes);
  const labour = between(type.labour);
  const materials = between(type.materials);
  const followOn = !!type.followOnLikely;

  job.completedAt = completedAt;
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
}
