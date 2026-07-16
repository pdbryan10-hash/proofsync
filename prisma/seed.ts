/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- date helpers (all relative to run time so the demo always looks fresh) ---
const now = new Date();
function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function minsAfter(base: Date, mins: number): Date {
  return new Date(base.getTime() + mins * 60_000);
}

async function reset() {
  // Order matters for FK integrity.
  await prisma.syncEvent.deleteMany();
  await prisma.exception.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.processedEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.jobCompletion.deleteMany();
  await prisma.job.deleteMany();
  await prisma.mockConcertoJob.deleteMany();
  await prisma.fieldMapping.deleteMany();
  await prisma.integrationConnection.deleteMany();
  await prisma.client.deleteMany();
  await prisma.organisation.deleteMany();
}

// Canonical target field names (Concerto side) referenced across the app.
const T = {
  notes: 'contractorCompletionNotes',
  work: 'workCompletionDescription',
  duration: 'actualLabourDuration',
  arrival: 'actualArrivalTime',
  departure: 'actualDepartureTime',
  completion: 'actualCompletionDate',
  cost: 'contractorCost',
  followOn: 'followOnRequired',
};

async function main() {
  console.log('Seeding ProofSync demo data…');
  await reset();

  const org = await prisma.organisation.create({ data: { name: 'SEE Services' } });

  const client = await prisma.client.create({
    data: {
      organisationId: org.id,
      name: 'Midlands County Estates',
      concertoTenantName: 'midlands-county-concerto',
      active: true,
      // Policy per §12 example: notes + times + certificates ON, costs OFF,
      // approval required before close.
      syncCompletionNotes: true,
      syncTimes: true,
      syncCosts: false,
      syncMaterials: false,
      syncDocuments: true,
      syncStatus: true,
      requireApprovalBeforeClose: true,
    },
  });

  await prisma.integrationConnection.createMany({
    data: [
      {
        organisationId: org.id,
        provider: 'JOBLOGIC',
        name: 'SEE Services — Joblogic',
        status: 'CONNECTED',
        environment: 'mock',
        lastConnectionTestAt: minsAfter(now, -3),
        lastSuccessfulSyncAt: minsAfter(now, -2),
      },
      {
        organisationId: org.id,
        provider: 'CONCERTO',
        name: 'Midlands County Estates — Concerto',
        status: 'CONNECTED',
        environment: 'mock',
        lastConnectionTestAt: minsAfter(now, -3),
        lastSuccessfulSyncAt: minsAfter(now, -2),
      },
    ],
  });

  // --- Field mappings (org-level, §7/§11) -----------------------------------
  const mappings: {
    sourceField: string;
    targetField: string;
    transformationType: string;
    required?: boolean;
    transformConfig?: string;
  }[] = [
    { sourceField: 'engineerNotes', targetField: T.notes, transformationType: 'DIRECT' },
    { sourceField: 'workCompleted', targetField: T.work, transformationType: 'DIRECT' },
    { sourceField: 'timeOnSiteMinutes', targetField: T.duration, transformationType: 'MINUTES_TO_HOURS' },
    { sourceField: 'arrivalTime', targetField: T.arrival, transformationType: 'DATETIME_FORMAT' },
    { sourceField: 'departureTime', targetField: T.departure, transformationType: 'DATETIME_FORMAT' },
    { sourceField: 'completedAt', targetField: T.completion, transformationType: 'DATETIME_FORMAT' },
    {
      sourceField: 'followOnWorkRequired',
      targetField: T.followOn,
      transformationType: 'BOOLEAN_TO_TEXT',
      transformConfig: JSON.stringify({ trueText: 'Yes — follow-on raised', falseText: 'No' }),
    },
    { sourceField: 'totalCost', targetField: T.cost, transformationType: 'CURRENCY_FORMAT' },
  ];
  await prisma.fieldMapping.createMany({
    data: mappings.map((m, i) => ({
      organisationId: org.id,
      clientId: null,
      sourceProvider: 'JOBLOGIC',
      targetProvider: 'CONCERTO',
      sourceField: m.sourceField,
      targetField: m.targetField,
      transformationType: m.transformationType,
      transformConfig: m.transformConfig ?? null,
      required: m.required ?? false,
      active: true,
      sortOrder: i,
    })),
  });

  // Helper to create a job + completion + docs + mock target in one shot.
  interface JobSpec {
    joblogicJobId: string;
    concertoJobReference: string | null;
    siteName: string;
    siteAddress: string;
    assetReference?: string;
    jobDescription: string;
    engineerName: string;
    concertoStatus?: string;
    syncStatus: string;
    completedDaysAgo: number;
    completion?: {
      arrivalMins?: number; // minutes into the day
      timeOnSiteMinutes?: number;
      workCompleted?: string;
      engineerNotes?: string;
      labourCost?: number;
      materialsCost?: number;
      totalCost?: number;
      followOnWorkRequired?: boolean;
      followOnWorkNotes?: string;
    };
    documents?: { filename: string; documentType: string; sizeBytes: number; mockUploadShouldFail?: boolean }[];
    // Mock Concerto target
    target?: { exists: boolean; status?: string; fields?: Record<string, unknown>; mockUpdateShouldFail?: boolean };
    lastSyncDaysAgo?: number;
  }

  async function createJob(spec: JobSpec) {
    const completedAt = spec.completion ? daysAgo(spec.completedDaysAgo, 14, 30) : null;
    const arrival = spec.completion?.arrivalMins != null ? daysAgo(spec.completedDaysAgo, 13, 0) : null;
    const departure =
      arrival && spec.completion?.timeOnSiteMinutes != null
        ? minsAfter(arrival, spec.completion.timeOnSiteMinutes)
        : null;

    const job = await prisma.job.create({
      data: {
        organisationId: org.id,
        clientId: client.id,
        joblogicJobId: spec.joblogicJobId,
        concertoJobReference: spec.concertoJobReference,
        siteName: spec.siteName,
        siteAddress: spec.siteAddress,
        assetReference: spec.assetReference ?? null,
        jobDescription: spec.jobDescription,
        engineerName: spec.engineerName,
        joblogicStatus: 'Complete',
        concertoStatus: spec.concertoStatus ?? 'In Progress',
        scheduledDate: daysAgo(spec.completedDaysAgo, 9, 0),
        completedAt,
        lastSyncAt: spec.lastSyncDaysAgo != null ? daysAgo(spec.lastSyncDaysAgo, 15, 0) : null,
        syncStatus: spec.syncStatus,
      },
    });

    if (spec.completion) {
      await prisma.jobCompletion.create({
        data: {
          jobId: job.id,
          arrivalTime: arrival,
          departureTime: departure,
          timeOnSiteMinutes: spec.completion.timeOnSiteMinutes ?? null,
          workCompleted: spec.completion.workCompleted ?? null,
          engineerNotes: spec.completion.engineerNotes ?? null,
          labourCost: spec.completion.labourCost ?? null,
          materialsCost: spec.completion.materialsCost ?? null,
          totalCost: spec.completion.totalCost ?? null,
          followOnWorkRequired: spec.completion.followOnWorkRequired ?? false,
          followOnWorkNotes: spec.completion.followOnWorkNotes ?? null,
          completedAt,
          rawSourcePayload: JSON.stringify({ source: 'joblogic-mock', joblogicJobId: spec.joblogicJobId }),
        },
      });
    }

    if (spec.documents?.length) {
      await prisma.document.createMany({
        data: spec.documents.map((d) => ({
          jobId: job.id,
          sourceSystem: 'JOBLOGIC',
          sourceDocumentId: `JL-DOC-${Math.random().toString(36).slice(2, 8)}`,
          filename: d.filename,
          mimeType: 'application/pdf',
          documentType: d.documentType,
          sizeBytes: d.sizeBytes,
          sourceUrl: `mock://joblogic/documents/${encodeURIComponent(d.filename)}`,
          transferStatus:
            spec.syncStatus === 'SYNCED' ? 'TRANSFERRED' : d.mockUploadShouldFail && spec.syncStatus === 'PARTIAL' ? 'FAILED' : 'PENDING',
          transferredAt: spec.syncStatus === 'SYNCED' ? job.lastSyncAt : null,
          mockUploadShouldFail: d.mockUploadShouldFail ?? false,
        })),
      });
    }

    if (spec.concertoJobReference && spec.target?.exists !== false) {
      await prisma.mockConcertoJob.create({
        data: {
          concertoJobReference: spec.concertoJobReference,
          status: spec.target?.status ?? 'In Progress',
          fields: JSON.stringify(spec.target?.fields ?? {}),
          mockUpdateShouldFail: spec.target?.mockUpdateShouldFail ?? false,
        },
      });
    }

    return job;
  }

  // Pre-computed "already matches" arrival ISO for the hero job so exactly six
  // fields remain to update (demonstrates the ALREADY_MATCHES status too).
  const heroArrival = daysAgo(1, 13, 0).toISOString();

  // === 1. HERO — the primary demo job =======================================
  const hero = await createJob({
    joblogicJobId: 'JL-48392',
    concertoJobReference: 'CON-284731',
    siteName: 'Riverside House, Nottingham',
    siteAddress: 'Riverside House, Electric Avenue, Nottingham, NG2 1AB',
    assetReference: 'EL-2F-CORR-07',
    jobDescription: 'Emergency lighting fault — second floor corridor',
    engineerName: 'Mark Taylor',
    syncStatus: 'READY',
    completedDaysAgo: 1,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 127,
      workCompleted:
        'Replaced failed emergency lighting battery pack. Unit function tested and confirmed operational. 3-hour duration discharge test passed.',
      engineerNotes:
        'On arrival, second-floor corridor emergency luminaire showing fault LED. Isolated circuit, replaced battery pack (part EM-BP-3H), reinstated supply and completed discharge test. Advised client of adjacent unit nearing end of life.',
      labourCost: 118.5,
      materialsCost: 42.0,
      totalCost: 160.5,
      followOnWorkRequired: false,
    },
    documents: [{ filename: 'Emergency_Lighting_Certificate.pdf', documentType: 'CERTIFICATE', sizeBytes: 184_320 }],
    // Target starts largely blank (arrival already recorded so it "already matches").
    target: { exists: true, status: 'In Progress', fields: { [T.arrival]: heroArrival } },
  });

  // === 2. Already synced ====================================================
  const synced = await createJob({
    joblogicJobId: 'JL-48377',
    concertoJobReference: 'CON-284745',
    siteName: 'Civic Offices, Derby',
    siteAddress: 'Civic Offices, Corporation Street, Derby, DE1 2FS',
    assetReference: 'AHU-03',
    jobDescription: 'AHU-03 drive belt replacement and filter service',
    engineerName: 'Sarah Okafor',
    concertoStatus: 'In Progress',
    syncStatus: 'SYNCED',
    completedDaysAgo: 2,
    lastSyncDaysAgo: 2,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 95,
      workCompleted: 'Replaced worn drive belt on AHU-03, renewed panel filters (G4), checked motor current draw — within spec.',
      engineerNotes: 'Belt showing cracking. Replaced and tensioned. Filters replaced. Unit running normally on handover.',
      labourCost: 88.0,
      materialsCost: 36.5,
      totalCost: 124.5,
      followOnWorkRequired: false,
    },
    documents: [{ filename: 'AHU03_Service_Report.pdf', documentType: 'SERVICE_REPORT', sizeBytes: 96_500 }],
    target: {
      exists: true,
      status: 'Completed',
      fields: {
        [T.notes]: 'Belt showing cracking. Replaced and tensioned. Filters replaced. Unit running normally on handover.',
        [T.work]: 'Replaced worn drive belt on AHU-03, renewed panel filters (G4), checked motor current draw — within spec.',
        [T.duration]: 1.58,
        [T.completion]: daysAgo(2, 14, 30).toISOString(),
        [T.followOn]: 'No',
      },
    },
  });

  // Historic successful run + full audit timeline for the synced job.
  const runStart = daysAgo(2, 15, 0);
  const syncedRun = await prisma.syncRun.create({
    data: {
      jobId: synced.id,
      direction: 'JOBLOGIC_TO_CONCERTO',
      triggerType: 'WEBHOOK',
      status: 'SUCCESS',
      startedAt: runStart,
      completedAt: minsAfter(runStart, 0.08),
      attemptNumber: 1,
      durationMs: 5200,
      fieldsUpdated: 5,
      documentsTransferred: 1,
      idempotencyKey: 'job:JL-48377:job.completed:seed',
      createdAt: runStart,
    },
  });
  const timeline: [string, string, string, number][] = [
    ['VALIDATING', 'INFO', 'Completion event received from Joblogic (webhook)', 0],
    ['VALIDATING', 'INFO', 'Joblogic job JL-48377 loaded', 1],
    ['VALIDATING', 'SUCCESS', 'Concerto reference CON-284745 validated', 1],
    ['MATCHING', 'SUCCESS', 'Target Concerto record located (CON-284745)', 2],
    ['TRANSFORMING', 'SUCCESS', '5 field changes identified (1 excluded by client rule)', 3],
    ['UPDATING', 'SUCCESS', 'Completion notes updated', 3],
    ['UPDATING', 'SUCCESS', 'Time on site updated: 1h 35m', 4],
    ['UPLOADING_DOCUMENTS', 'SUCCESS', 'Certificate uploaded: AHU03_Service_Report.pdf', 5],
    ['VERIFYING', 'SUCCESS', 'Concerto record verified — target matches expected values', 6],
    ['SUCCESS', 'SUCCESS', 'Sync completed successfully in 5.2s', 6],
  ];
  for (const [stage, level, message, sec] of timeline) {
    await prisma.syncEvent.create({
      data: { syncRunId: syncedRun.id, stage, level, message, createdAt: new Date(runStart.getTime() + sec * 1000) },
    });
  }
  await prisma.processedEvent.create({
    data: { idempotencyKey: 'job:JL-48377:job.completed:seed', joblogicJobId: 'JL-48377', eventType: 'job.completed', syncRunId: syncedRun.id },
  });

  // === 3. Missing Concerto reference (resolvable in demo) ====================
  const missingRef = await createJob({
    joblogicJobId: 'JL-48411',
    concertoJobReference: null,
    siteName: 'Meadow Court, Leicester',
    siteAddress: 'Meadow Court, Granby Street, Leicester, LE1 6FB',
    assetReference: 'PLM-B1',
    jobDescription: 'Water leak investigation — basement plant room',
    engineerName: 'David Reilly',
    syncStatus: 'EXCEPTION',
    completedDaysAgo: 1,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 74,
      workCompleted: 'Traced leak to failed gland on circulating pump. Isolated, replaced gland seal, pressure tested — no further leak.',
      engineerNotes: 'Minor water damage to floor. Recommend follow-on inspection of adjacent valve.',
      totalCost: 96.0,
      followOnWorkRequired: true,
      followOnWorkNotes: 'Inspect adjacent isolation valve for corrosion.',
    },
    documents: [{ filename: 'Leak_Completion_Sheet.pdf', documentType: 'COMPLETION_SHEET', sizeBytes: 72_100 }],
    // No reference on the Joblogic side — but a valid target DOES exist under
    // CON-284811, so entering it in the exceptions screen lets the retry succeed.
    target: { exists: false },
  });
  await prisma.mockConcertoJob.create({
    data: { concertoJobReference: 'CON-284811', status: 'In Progress', fields: JSON.stringify({}) },
  });
  await prisma.exception.create({
    data: {
      jobId: missingRef.id,
      type: 'MISSING_CONCERTO_REFERENCE',
      severity: 'HIGH',
      title: 'Missing Concerto reference',
      description:
        'Cannot update Concerto because no Concerto job reference is stored against this Joblogic job. Add the correct reference to retry.',
      status: 'OPEN',
    },
  });

  // === 4. Target not found ==================================================
  const notFound = await createJob({
    joblogicJobId: 'JL-48420',
    concertoJobReference: 'CON-999999',
    siteName: 'Northgate Depot, Lincoln',
    siteAddress: 'Northgate Depot, Outer Circle Road, Lincoln, LN2 4HY',
    assetReference: 'FA-PANEL-1',
    jobDescription: 'Fire alarm panel fault — zone 4 intermittent',
    engineerName: 'Priya Shah',
    syncStatus: 'EXCEPTION',
    completedDaysAgo: 3,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 110,
      workCompleted: 'Replaced faulty zone 4 detector base, tested loop, cleared fault. Panel healthy on handover.',
      engineerNotes: 'Intermittent fault traced to corroded detector base. Full loop test passed.',
      totalCost: 143.75,
      followOnWorkRequired: false,
    },
    documents: [{ filename: 'Fire_Alarm_Test_Certificate.pdf', documentType: 'CERTIFICATE', sizeBytes: 128_400 }],
    target: { exists: false }, // no CON-999999 target row → not found
  });
  await prisma.exception.create({
    data: {
      jobId: notFound.id,
      type: 'TARGET_JOB_NOT_FOUND',
      severity: 'HIGH',
      title: 'Target Concerto job not found',
      description: 'No Concerto job was found for reference CON-999999. Confirm the reference held in Joblogic is correct.',
      status: 'OPEN',
    },
  });

  // === 5. Certificate upload failure → PARTIAL ==============================
  const partial = await createJob({
    joblogicJobId: 'JL-48405',
    concertoJobReference: 'CON-284760',
    siteName: 'Waterside Academy, Nottingham',
    siteAddress: 'Waterside Academy, Trent Lane, Nottingham, NG10 1AA',
    assetReference: 'BLR-2',
    jobDescription: 'Annual boiler service — boiler house 2',
    engineerName: 'Mark Taylor',
    syncStatus: 'PARTIAL',
    completedDaysAgo: 1,
    lastSyncDaysAgo: 1,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 165,
      workCompleted: 'Completed annual service on gas boiler 2. Cleaned burner, checked flue gas analysis, renewed filter. Within tolerance.',
      engineerNotes: 'Service completed. FGA results attached. Certificate upload to Concerto failed on first attempt.',
      totalCost: 210.0,
      followOnWorkRequired: false,
    },
    documents: [
      { filename: 'Gas_Safety_Certificate.pdf', documentType: 'CERTIFICATE', sizeBytes: 156_000, mockUploadShouldFail: true },
    ],
    target: {
      exists: true,
      status: 'In Progress',
      fields: {
        [T.notes]: 'Service completed. FGA results attached. Certificate upload to Concerto failed on first attempt.',
        [T.work]: 'Completed annual service on gas boiler 2. Cleaned burner, checked flue gas analysis, renewed filter. Within tolerance.',
        [T.duration]: 2.75,
        [T.completion]: daysAgo(1, 14, 30).toISOString(),
        [T.followOn]: 'No',
      },
    },
  });
  const partialRunStart = daysAgo(1, 15, 30);
  const partialRun = await prisma.syncRun.create({
    data: {
      jobId: partial.id,
      direction: 'JOBLOGIC_TO_CONCERTO',
      triggerType: 'WEBHOOK',
      status: 'PARTIAL',
      startedAt: partialRunStart,
      completedAt: minsAfter(partialRunStart, 0.1),
      attemptNumber: 1,
      durationMs: 6100,
      fieldsUpdated: 5,
      documentsTransferred: 0,
      createdAt: partialRunStart,
    },
  });
  await prisma.exception.create({
    data: {
      jobId: partial.id,
      syncRunId: partialRun.id,
      type: 'DOCUMENT_UPLOAD_FAILED',
      severity: 'MEDIUM',
      title: 'Certificate upload failed',
      description: 'Core job data synchronised successfully, but Gas_Safety_Certificate.pdf failed to upload to Concerto (virus-scan timeout). Retry the document transfer.',
      status: 'OPEN',
    },
  });

  // === 6. API temporarily unavailable (retryable) ==========================
  const apiDown = await createJob({
    joblogicJobId: 'JL-48430',
    concertoJobReference: 'CON-284770',
    siteName: 'Guildhall, Leicester',
    siteAddress: 'Guildhall, Guildhall Lane, Leicester, LE1 5FQ',
    assetReference: 'LIFT-1',
    jobDescription: 'Passenger lift — door reopening fault',
    engineerName: 'Sarah Okafor',
    syncStatus: 'FAILED',
    completedDaysAgo: 1,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 88,
      workCompleted: 'Adjusted door detector alignment and lubricated door track. Reopening fault cleared on test.',
      engineerNotes: 'Door safety edge misaligned. Realigned and tested 20 cycles — no fault.',
      totalCost: 132.0,
      followOnWorkRequired: false,
    },
    documents: [{ filename: 'Lift_Service_Report.pdf', documentType: 'SERVICE_REPORT', sizeBytes: 88_200 }],
    // Target exists but simulates a transient outage — retry will succeed.
    target: { exists: true, status: 'In Progress', fields: {}, mockUpdateShouldFail: true },
  });
  await prisma.exception.create({
    data: {
      jobId: apiDown.id,
      type: 'API_UNAVAILABLE',
      severity: 'MEDIUM',
      title: 'Concerto API temporarily unavailable',
      description: 'Concerto returned HTTP 503 during update. This is a transient error and is eligible for automatic retry.',
      status: 'OPEN',
    },
  });

  // === 7. Required completion note missing =================================
  const missingNote = await createJob({
    joblogicJobId: 'JL-48441',
    concertoJobReference: 'CON-284782',
    siteName: 'Beaumont Leys Clinic, Leicester',
    siteAddress: 'Beaumont Leys Clinic, Home Farm Walk, Leicester, LE4 1AT',
    assetReference: 'DOOR-A',
    jobDescription: 'Automatic entrance door — sensor fault',
    engineerName: 'David Reilly',
    syncStatus: 'EXCEPTION',
    completedDaysAgo: 4,
    completion: {
      arrivalMins: 0,
      timeOnSiteMinutes: 60,
      workCompleted: '',
      engineerNotes: '',
      totalCost: 90.0,
      followOnWorkRequired: false,
    },
    target: { exists: true, status: 'In Progress', fields: {} },
  });
  await prisma.exception.create({
    data: {
      jobId: missingNote.id,
      type: 'REQUIRED_FIELD_MISSING',
      severity: 'MEDIUM',
      title: 'Required completion note missing',
      description: 'The engineer completion notes and work-completed description are empty in Joblogic. Concerto requires a completion description before the job can be updated.',
      status: 'IN_REVIEW',
    },
  });

  // === Filler synced jobs (bring the set to ~20, realistic history) =========
  const fillerEngineers = ['Mark Taylor', 'Sarah Okafor', 'David Reilly', 'Priya Shah', 'Tom Bennett'];
  const fillerJobs = [
    ['CON-284611', 'County Hall, Nottingham', 'Lighting — replace failed LED panels, open plan office'],
    ['CON-284622', 'Central Library, Derby', 'Reactive plumbing — WC cistern overflow'],
    ['CON-284633', 'Highfields Depot, Lincoln', 'PPM — monthly generator load test'],
    ['CON-284644', 'Market Hall, Loughborough', 'HVAC — reset tripped condensing unit'],
    ['CON-284655', 'Riverside House, Nottingham', 'Electrical — remedial works from EICR C2'],
    ['CON-284666', 'Civic Offices, Derby', 'Door entry — replace faulty maglock'],
    ['CON-284677', 'Meadow Court, Leicester', 'Drainage — clear blocked gully, car park'],
    ['CON-284688', 'Guildhall, Leicester', 'Fire — replace expired extinguishers'],
    ['CON-284699', 'Beaumont Leys Clinic, Leicester', 'Heating — bleed radiators, balance system'],
    ['CON-284710', 'Waterside Academy, Nottingham', 'Roofing — repair flashing, sports hall'],
    ['CON-284721', 'Northgate Depot, Lincoln', 'Security — realign shutter, loading bay'],
    ['CON-284733', 'Central Library, Derby', 'Lighting — emergency light 6-monthly test'],
    ['CON-284744', 'County Hall, Nottingham', 'Plumbing — replace TMV, staff kitchen'],
  ] as const;

  const syncedFillerJobs = [];
  for (let i = 0; i < fillerJobs.length; i++) {
    const [ref, site, desc] = fillerJobs[i]!;
    const dago = 2 + (i % 12);
    const mins = 45 + ((i * 17) % 140);
    const total = 80 + ((i * 13) % 160);
    const j = await createJob({
      joblogicJobId: `JL-484${(50 + i).toString()}`,
      concertoJobReference: ref,
      siteName: site,
      siteAddress: `${site} — see Concerto record`,
      jobDescription: desc,
      engineerName: fillerEngineers[i % fillerEngineers.length]!,
      concertoStatus: 'Completed',
      syncStatus: 'SYNCED',
      completedDaysAgo: dago,
      lastSyncDaysAgo: dago,
      completion: {
        arrivalMins: 0,
        timeOnSiteMinutes: mins,
        workCompleted: `${desc} — completed and tested. Site left clean and safe.`,
        engineerNotes: 'Works completed as scheduled. No follow-on required.',
        totalCost: total,
        followOnWorkRequired: false,
      },
      documents: [{ filename: `${ref}_Completion.pdf`, documentType: 'COMPLETION_SHEET', sizeBytes: 60_000 + i * 1000 }],
      target: {
        exists: true,
        status: 'Completed',
        fields: {
          [T.notes]: 'Works completed as scheduled. No follow-on required.',
          [T.work]: `${desc} — completed and tested. Site left clean and safe.`,
          [T.duration]: Math.round((mins / 60) * 100) / 100,
          [T.completion]: daysAgo(dago, 14, 30).toISOString(),
          [T.followOn]: 'No',
        },
      },
    });
    syncedFillerJobs.push(j);
  }

  // --- Historical sync-run volume for the activity chart & KPIs -------------
  await seedHistory([synced, partial, ...syncedFillerJobs]);

  const jobCount = await prisma.job.count();
  const runCount = await prisma.syncRun.count();
  const excCount = await prisma.exception.count();
  console.log(`Seed complete: ${jobCount} jobs, ${runCount} sync runs, ${excCount} exceptions.`);
  console.log(`Primary demo job: ${hero.joblogicJobId} → CON-284731.`);
}

/**
 * Creates a realistic spread of historical sync runs so the dashboard chart and
 * KPI cards are populated. Today is weighted to yield ~47 processed / ~91.5%
 * success, matching the demo narrative.
 */
async function seedHistory(jobs: { id: string; concertoJobReference: string | null }[]) {
  if (jobs.length === 0) return;
  let pick = 0;
  const nextJob = () => jobs[pick++ % jobs.length]!;

  const daySpec: { day: number; success: number; partial: number; exception: number; failed: number }[] = [];
  for (let d = 13; d >= 1; d--) {
    // Weekends lighter; weekdays busier. Deterministic, no RNG.
    const base = 8 + ((d * 7) % 14);
    daySpec.push({ day: d, success: base, partial: d % 5 === 0 ? 1 : 0, exception: d % 4 === 0 ? 1 : 0, failed: 0 });
  }
  // Today — tuned to the narrative.
  daySpec.push({ day: 0, success: 40, partial: 3, exception: 3, failed: 1 });

  for (const spec of daySpec) {
    const rows: {
      status: string;
      count: number;
    }[] = [
      { status: 'SUCCESS', count: spec.success },
      { status: 'PARTIAL', count: spec.partial },
      { status: 'EXCEPTION', count: spec.exception },
      { status: 'FAILED', count: spec.failed },
    ];
    for (const { status, count } of rows) {
      for (let i = 0; i < count; i++) {
        const started = daysAgo(spec.day, 8 + (i % 9), (i * 7) % 60);
        const job = nextJob();
        await prisma.syncRun.create({
          data: {
            jobId: job.id,
            direction: 'JOBLOGIC_TO_CONCERTO',
            triggerType: i % 3 === 0 ? 'WEBHOOK' : 'POLLING',
            status,
            startedAt: started,
            completedAt: minsAfter(started, 0.1),
            attemptNumber: 1,
            durationMs: 4200 + ((i * 137) % 3200),
            fieldsUpdated: status === 'SUCCESS' || status === 'PARTIAL' ? 5 : 0,
            documentsTransferred: status === 'SUCCESS' ? 1 : 0,
            createdAt: started,
          },
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
