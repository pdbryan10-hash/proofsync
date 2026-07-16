import type { Collection } from 'mongodb';
import { getSourceDb } from './mongo';

/**
 * Screenshot evidence from the browser transport.
 *
 * A headed demo is persuasive in the room and gone the moment the window
 * closes. These are the durable artefact: proof, after the fact, that a browser
 * really did sign in and really did type into the client's system. They survive
 * into a recording, a follow-up email, or an audit.
 *
 * Stored in Mongo rather than on disk because the filesystem is not writable on
 * a serverless host and would not survive a deploy — and because a screenshot
 * belongs with the record it evidences, not in a folder somebody has to find.
 */

export type ShotStage =
  | 'signed-in'
  | 'source-read'
  | 'form-filled'
  | 'saved'
  | 'verified'
  | 'failed';

export interface ShotDoc {
  /** What the shot is about: a job number, a work-order reference, or a system. */
  subject: string;
  system: 'JOBLOGIC' | 'CONCERTO';
  stage: ShotStage;
  caption: string;
  url: string;
  /** PNG bytes, base64. Small enough at 1280x800 to sit comfortably in a doc. */
  png: string;
  capturedAt: Date;
}

/**
 * Keep the collection from growing without bound during a long demo. Roughly
 * five shots per sync, so this holds a couple of hours of continuous running.
 */
const MAX_SHOTS = 240;

async function shots(): Promise<Collection<ShotDoc>> {
  return (await getSourceDb()).collection<ShotDoc>('_proofsync_demo_shots');
}

export async function saveShot(doc: Omit<ShotDoc, 'capturedAt'>): Promise<void> {
  const col = await shots();
  await col.insertOne({ ...doc, capturedAt: new Date() });

  // Trim oldest beyond the cap. Cheap, and keeps Atlas storage predictable.
  const count = await col.countDocuments({});
  if (count > MAX_SHOTS) {
    const stale = await col
      .find({}, { projection: { _id: 1 } })
      .sort({ capturedAt: 1 })
      .limit(count - MAX_SHOTS)
      .toArray();
    if (stale.length) {
      await col.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }
  }
}

export interface ShotSummary {
  id: string;
  system: string;
  stage: string;
  caption: string;
  url: string;
  capturedAt: string;
}

/** Shot metadata for a set of subjects — never the bytes; those come per-image. */
export async function shotsForSubjects(subjects: string[]): Promise<Record<string, ShotSummary[]>> {
  if (subjects.length === 0) return {};
  const col = await shots();
  const docs = await col
    .find({ subject: { $in: subjects } }, { projection: { png: 0 } })
    .sort({ capturedAt: 1 })
    .toArray();

  const grouped: Record<string, ShotSummary[]> = {};
  for (const d of docs) {
    (grouped[d.subject] ??= []).push({
      id: String(d._id),
      system: d.system,
      stage: d.stage,
      caption: d.caption,
      url: d.url,
      capturedAt: d.capturedAt.toISOString(),
    });
  }
  return grouped;
}

export async function shotPng(id: string): Promise<Buffer | null> {
  const { ObjectId } = await import('mongodb');
  if (!ObjectId.isValid(id)) return null;
  const col = await shots();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return Buffer.from(doc.png, 'base64');
}

export async function clearShots(): Promise<void> {
  const col = await shots();
  await col.deleteMany({});
}
