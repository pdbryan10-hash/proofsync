import { MongoClient, type Db, type Collection } from 'mongodb';
import {
  getSourceDbUri,
  getTargetDbUri,
  getSourceDbName,
  getTargetDbName,
} from './config';
import type { SourceJobDoc, SourceUserDoc, TargetWorkOrderDoc, TargetUserDoc } from './schema';

/**
 * Raw MongoDB access to the two stand-in systems.
 *
 * Deliberately NOT Prisma. Joblogic and Concerto are foreign systems: they do
 * not share ProofSync's ORM, its schema, or its client. Reaching them through
 * their own driver and their own connection pool is what makes "two separate
 * systems" structurally true rather than a naming convention over one database.
 *
 * ProofSync's own store stays on Prisma (lib/db/prisma.ts) and is never touched
 * from this file.
 */

type ClientCache = {
  demoSourceClient?: Promise<MongoClient>;
  demoTargetClient?: Promise<MongoClient>;
};

const cache = globalThis as unknown as ClientCache;

/** Separate clients — separate pools — so neither system can see the other's. */
function connect(uri: string): Promise<MongoClient> {
  return new MongoClient(uri, {
    // Two stand-in systems × many short-lived serverless instances add up fast
    // on a shared cluster. Keep each pool tiny so the demo can't exhaust Atlas
    // connections and hang beats waiting for one.
    maxPoolSize: 2,
    minPoolSize: 0,
    maxIdleTimeMS: 10_000,
    serverSelectionTimeoutMS: 8_000,
  }).connect();
}

export async function getSourceDb(): Promise<Db> {
  if (!cache.demoSourceClient) {
    cache.demoSourceClient = connect(getSourceDbUri()).catch((err) => {
      // Never cache a failed connection — the next call must retry.
      cache.demoSourceClient = undefined;
      throw err;
    });
  }
  return (await cache.demoSourceClient).db(getSourceDbName());
}

export async function getTargetDb(): Promise<Db> {
  if (!cache.demoTargetClient) {
    cache.demoTargetClient = connect(getTargetDbUri()).catch((err) => {
      cache.demoTargetClient = undefined;
      throw err;
    });
  }
  return (await cache.demoTargetClient).db(getTargetDbName());
}

// --- Typed collection accessors ---------------------------------------------

export async function sourceJobs(): Promise<Collection<SourceJobDoc>> {
  return (await getSourceDb()).collection<SourceJobDoc>('jobs');
}

export async function sourceUsers(): Promise<Collection<SourceUserDoc>> {
  return (await getSourceDb()).collection<SourceUserDoc>('users');
}

export async function targetWorkOrders(): Promise<Collection<TargetWorkOrderDoc>> {
  return (await getTargetDb()).collection<TargetWorkOrderDoc>('work_orders');
}

export async function targetUsers(): Promise<Collection<TargetUserDoc>> {
  return (await getTargetDb()).collection<TargetUserDoc>('users');
}

/**
 * Control collection for the demo runner itself. Lives in the SOURCE database
 * purely because it needs a home outside Prisma; nothing reads it as if it were
 * Joblogic data.
 */
export async function demoControl(): Promise<Collection<DemoControlDoc>> {
  return (await getSourceDb()).collection<DemoControlDoc>('_proofsync_demo_control');
}

export interface DemoControlDoc {
  _id: string;
  lastTickAt: Date | null;
  tickCount: number;
  jobSequence: number;
  seededAt: Date | null;
  /** Cluster-wide beat lock (see lib/demo/tick.ts). Null/absent = free. */
  lockedAt?: Date | null;
  /** While set to a future time, beats stand down so a reset can run cleanly. */
  pausedUntil?: Date | null;
  /**
   * Which demo organisation is live. "Start over" increments this instead of
   * deleting the ledger — a fresh org has nothing to delete, so reset is instant
   * and can't race or time out. Old orgs are simply abandoned.
   */
  orgEpoch?: number;
}

/** Indexes the demo systems would plausibly have. Safe to call repeatedly. */
export async function ensureDemoIndexes(): Promise<void> {
  const [jobs, wos] = await Promise.all([sourceJobs(), targetWorkOrders()]);
  await Promise.all([
    jobs.createIndex({ jobNumber: 1 }, { unique: true }),
    jobs.createIndex({ status: 1, completedAt: -1 }),
    wos.createIndex({ reference: 1 }, { unique: true }),
    wos.createIndex({ updatedAt: -1 }),
  ]);
}
