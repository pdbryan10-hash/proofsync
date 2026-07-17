import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { sourceJobs, targetWorkOrders } from '@/lib/demo/mongo';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Cross-system search. ProofSync is signed in to BOTH systems, so from one box it
 * can find any record — or any file — in either the contractor's system or the
 * client's, without asking a person to log into each. That reach is the point:
 * two disconnected systems, one place to look.
 */
export interface SearchHit {
  system: 'Joblogic' | 'Concerto';
  kind: 'job' | 'work order' | 'file';
  title: string;
  subtitle: string;
  reference: string;
}

// Escape user input before it becomes a Mongo regex.
function rx(q: string): RegExp {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export async function GET(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (q.length < 2) return ok({ query: q, hits: [] });

    const re = rx(q);
    const [jobsCol, wosCol] = await Promise.all([sourceJobs(), targetWorkOrders()]);

    const [jobs, wos] = await Promise.all([
      jobsCol
        .find({
          $or: [
            { jobNumber: re },
            { customerOrderRef: re },
            { description: re },
            { siteName: re },
            { 'engineer.engineerName': re },
            { 'attachments.fileName': re },
            { 'attachments.category': re },
          ],
        })
        .limit(20)
        .toArray(),
      wosCol
        .find({
          $or: [
            { reference: re },
            { summary: re },
            { 'property.propertyName': re },
            { 'documents.fileName': re },
          ],
        })
        .limit(20)
        .toArray(),
    ]);

    const hits: SearchHit[] = [];

    for (const j of jobs) {
      hits.push({
        system: 'Joblogic',
        kind: 'job',
        title: `${j.jobNumber} — ${j.description}`,
        subtitle: `${j.siteName}${j.engineer ? ` · ${j.engineer.engineerName}` : ''}`,
        reference: j.customerOrderRef ?? j.jobNumber,
      });
      // Surface matching files as their own hits — "any record or file".
      for (const a of j.attachments ?? []) {
        if (re.test(a.fileName) || re.test(a.category)) {
          hits.push({
            system: 'Joblogic',
            kind: 'file',
            title: a.fileName,
            subtitle: `${a.category} · attached to ${j.jobNumber}`,
            reference: j.jobNumber,
          });
        }
      }
    }

    for (const w of wos) {
      hits.push({
        system: 'Concerto',
        kind: 'work order',
        title: `${w.reference} — ${w.summary}`,
        subtitle: `${w.property?.propertyName ?? ''} · ${w.status}`,
        reference: w.reference,
      });
      for (const d of w.documents ?? []) {
        if (re.test(d.fileName)) {
          hits.push({
            system: 'Concerto',
            kind: 'file',
            title: d.fileName,
            subtitle: `uploaded to ${w.reference}`,
            reference: w.reference,
          });
        }
      }
    }

    return ok({ query: q, hits: hits.slice(0, 24) });
  } catch (error) {
    return handleRouteError(error);
  }
}
