import { DemoConcertoConnector } from '@/lib/integrations/concerto/demo';
import { DemoJoblogicConnector } from '@/lib/integrations/joblogic/demo';
import { sourceJobs } from './mongo';
import type { SourceAttachmentDoc } from './schema';

/**
 * WORK INTAKE — the engine's inbound direction.
 *
 * The mirror of the outbound sync. The client raises work in their own CAFM;
 * ProofSync pulls it, validates it, gives it a deterministic field-system id, and
 * routes it into Joblogic — where it dispatches to an engineer. Then the outbound
 * engine closes the loop on completion.
 *
 * BOUNDARY (the whole point): this file is ENGINE. It owns the workflow — pull,
 * validate, assign, route, acknowledge — and nothing about how either system
 * stores a job. The two I/O seams live in the connectors:
 *   - client.receiveNewJobs()  — pull raised jobs off the client CAFM
 *   - field.createJob()        — create the job in the field system
 *   - client.markReceived()    — acknowledge, so the poll never re-imports
 * A new client system means implementing those seams. The engine never changes.
 */

/** The normalised shape a raised job takes once it leaves a client connector. */
export interface IntakeJob {
  reference: string;
  siteName: string;
  siteAddress: string;
  assetRef: string | null;
  summary: string;
}

export interface IntakeAssignment {
  engineerId: string;
  engineerName: string;
}

const ENGINEERS: IntakeAssignment[] = [
  { engineerId: 'ENG-114', engineerName: 'D. Whitaker' },
  { engineerId: 'ENG-207', engineerName: 'S. Nkemelu' },
  { engineerId: 'ENG-233', engineerName: 'R. Kaur' },
  { engineerId: 'ENG-318', engineerName: 'M. Okonkwo' },
  { engineerId: 'ENG-402', engineerName: 'L. Faulkner' },
  { engineerId: 'ENG-455', engineerName: 'A. Bianchi' },
];

/** Pick an engineer from the job's reference so it's STABLE and VARIED per job —
 *  the loop index isn't usable here because intake pulls one job at a time (index
 *  is always 0), which is why every job used to get the same engineer. */
function engineerFor(reference: string): IntakeAssignment {
  const n = parseInt(reference.replace(/\D/g, ''), 10) || 0;
  return ENGINEERS[n % ENGINEERS.length]!;
}

/**
 * Deterministic field-system id for a client reference — so re-polling the same
 * raised job can never create two Joblogic jobs. CON-70001 -> JL-970001 (keeps
 * the JL- prefix the rest of the demo filters on).
 */
export function intakeJobNumber(reference: string): string {
  return `JL-${reference.replace(/^CON-/, '9')}`;
}

export interface IntakeResult {
  seen: number;
  created: number;
  jobNumbers: string[];
}

/**
 * Run one intake pass: pull raised jobs, route each into the field system.
 *
 * `limit` caps how many are processed this call. The demo uses it to pull in
 * small visible waves (call repeatedly until nothing is left), so you watch jobs
 * move from the client's system into yours a few at a time rather than all at
 * once. Omit it and the whole backlog is pulled in one pass.
 */
export async function runIntake(limit?: number): Promise<IntakeResult> {
  const client = new DemoConcertoConnector(); // client CAFM connector (inbound source)
  const field = new DemoJoblogicConnector(); // field system connector (intake target)

  const all = await client.receiveNewJobs(); // SEAM: pull raised jobs
  const raised = limit && limit > 0 ? all.slice(0, limit) : all;
  const jobNumbers: string[] = [];

  for (let i = 0; i < raised.length; i++) {
    const job = raised[i]!;
    // Engine: validate + assign a deterministic id (idempotent) + an engineer.
    if (!job.reference) continue;
    const jobNumber = intakeJobNumber(job.reference);
    const engineer = engineerFor(job.reference);

    await field.createJob(job, jobNumber, engineer); // SEAM: create in the field system
    await client.markReceived(job.reference, jobNumber); // SEAM: acknowledge the pickup
    jobNumbers.push(jobNumber);
  }

  return { seen: raised.length, created: jobNumbers.length, jobNumbers };
}

/**
 * A few completed jobs carry FOLLOW-ON work — the job is done and syncs clean, but
 * the engineer flagged something the client must now action (rebook access, raise
 * a quote, fit parts on a return visit). This is NOT an exception: the write-back
 * succeeds. It rides back into the client's system as a flag for THEM to pick up,
 * and ProofSync surfaces it as its own amber category. Keyed by field-system job
 * number; avoids the two exception jobs (JL-970005, JL-970014).
 */
const FOLLOW_ON: Record<string, string> = {
  'JL-970003': 'No access — site locked, tenant absent. Rebook required.',
  'JL-970009': 'Quote required — remedial works beyond the call scope.',
  'JL-970017': 'Parts on order — return visit needed to complete.',
};

/**
 * SIMULATED WORLD — not the engine, not a connector.
 *
 * Stands in for the engineer attending and completing the jobs Work Intake
 * dispatched into Joblogic. In production this is real people doing real work in
 * the field system; here it fills in a plausible completion so the outbound sync
 * can then close the loop. Kept deliberately separate from the engine.
 */
export async function completeIntakeJobs(limit?: number): Promise<{ completed: number }> {
  const jobs = await sourceJobs();
  const cursor = jobs.find({ jobNumber: { $regex: '^JL-97' }, status: 'Allocated' });
  if (limit && limit > 0) cursor.limit(limit);
  const allocated = await cursor.toArray();

  const now = new Date();
  for (const j of allocated) {
    const followOn = FOLLOW_ON[j.jobNumber] ?? null;
    await jobs.updateOne(
      { jobNumber: j.jobNumber },
      {
        $set: {
          status: 'Complete',
          completedAt: now,
          visit: {
            arrivedAt: new Date(now.getTime() - 85 * 60_000),
            departedAt: now,
            minutesOnSite: 85,
          },
          completionSheet: {
            workCarriedOut: 'Attended and completed the raised works. Site left safe and operational.',
            engineerComments: followOn
              ? `Works completed. Follow-on: ${followOn}`
              : 'Job completed in full. No follow-on required.',
            followOnRequired: !!followOn,
            followOnDetail: followOn,
          },
          charges: { labourCharge: 150, materialsCharge: 40, totalCharge: 190 },
          // Every completed job leaves paperwork: a job sheet always, plus a
          // certificate where the work is a service, measurement or test — so the
          // closed loop shows real documents transferring back, not just fields.
          attachments: buildIntakeAttachments(j.jobNumber, j.description ?? ''),
          updatedAt: now,
        },
      },
    );
  }
  return { completed: allocated.length };
}

/** Paperwork a completed intake job carries: a job sheet, and a certificate for
 *  servicing / measurement / testing work. */
function buildIntakeAttachments(jobNumber: string, description: string): SourceAttachmentDoc[] {
  const docs: SourceAttachmentDoc[] = [
    {
      attachmentId: `JL-ATT-${jobNumber}-1`,
      fileName: `job-sheet-${jobNumber}.pdf`,
      contentType: 'application/pdf',
      category: 'Service Sheet',
      bytes: 128_000,
    },
  ];
  if (/servic|measure|test|certif|inspect|monitor|compliance|hygiene|safety|calibrat/i.test(description)) {
    docs.push({
      attachmentId: `JL-ATT-${jobNumber}-2`,
      fileName: `certificate-${jobNumber}.pdf`,
      contentType: 'application/pdf',
      category: 'Test Certificate',
      bytes: 164_000,
    });
  }
  return docs;
}
