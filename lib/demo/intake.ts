import { DemoConcertoConnector } from '@/lib/integrations/concerto/demo';
import { DemoJoblogicConnector } from '@/lib/integrations/joblogic/demo';
import { sourceJobs } from './mongo';

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
];

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

/** Run one intake pass: pull raised jobs, route each into the field system. */
export async function runIntake(): Promise<IntakeResult> {
  const client = new DemoConcertoConnector(); // client CAFM connector (inbound source)
  const field = new DemoJoblogicConnector(); // field system connector (intake target)

  const raised = await client.receiveNewJobs(); // SEAM: pull raised jobs
  const jobNumbers: string[] = [];

  for (let i = 0; i < raised.length; i++) {
    const job = raised[i]!;
    // Engine: validate + assign a deterministic id (idempotent) + an engineer.
    if (!job.reference) continue;
    const jobNumber = intakeJobNumber(job.reference);
    const engineer = ENGINEERS[i % ENGINEERS.length]!;

    await field.createJob(job, jobNumber, engineer); // SEAM: create in the field system
    await client.markReceived(job.reference, jobNumber); // SEAM: acknowledge the pickup
    jobNumbers.push(jobNumber);
  }

  return { seen: raised.length, created: jobNumbers.length, jobNumbers };
}

/**
 * SIMULATED WORLD — not the engine, not a connector.
 *
 * Stands in for the engineer attending and completing the jobs Work Intake
 * dispatched into Joblogic. In production this is real people doing real work in
 * the field system; here it fills in a plausible completion so the outbound sync
 * can then close the loop. Kept deliberately separate from the engine.
 */
export async function completeIntakeJobs(): Promise<{ completed: number }> {
  const jobs = await sourceJobs();
  const allocated = await jobs
    .find({ jobNumber: { $regex: '^JL-97' }, status: 'Allocated' })
    .toArray();

  const now = new Date();
  for (const j of allocated) {
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
            engineerComments: 'Job completed in full. No follow-on required.',
            followOnRequired: false,
            followOnDetail: null,
          },
          charges: { labourCharge: 150, materialsCharge: 40, totalCharge: 190 },
          updatedAt: now,
        },
      },
    );
  }
  return { completed: allocated.length };
}
