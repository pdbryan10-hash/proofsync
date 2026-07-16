import { demoControl } from './mongo';
import { getTickSeconds, getDripPerTick } from './config';
import { dripSourceActivity, type DripResult } from './seeder';
import { ingestAndSync, type IngestResult } from './ingest';

/**
 * One beat of the demo.
 *
 * WHY THE SERVER OWNS THE CADENCE
 * -------------------------------
 * Vercel Cron cannot go below one minute, so a 30-second beat cannot come from
 * vercel.json. It comes from callers — the open console, the backstop cron —
 * pinging this more often than the interval, while the beat is CLAIMED here
 * atomically. Two people watching does not mean two beats; a browser refresh
 * does not skip one. The cadence is a property of the system, not of who has a
 * tab open.
 *
 * The claim is a single conditional findOneAndUpdate: Mongo guarantees
 * single-document atomicity, so exactly one concurrent caller can win a beat.
 */

const CONTROL_ID = 'demo-control';

export interface TickResult {
  ran: boolean;
  reason: string;
  tickCount: number;
  nextTickInMs: number;
  drip?: DripResult;
  sync?: IngestResult;
  durationMs?: number;
}

/**
 * In-process guard against overlapping beats.
 *
 * The Mongo claim stops two beats being *due* at once, but `force` deliberately
 * bypasses it — and the browser transport drives ONE shared Chromium page, which
 * a second concurrent beat would navigate out from under the first (the
 * "Target page has been closed" crash). This serialises beats within the
 * process: while one is running, every other caller — forced or not — is turned
 * away with `busy` rather than launching a colliding drive.
 */
const runningTick = globalThis as unknown as { demoTickInFlight?: boolean };

export async function runTick(options: { force?: boolean } = {}): Promise<TickResult> {
  if (runningTick.demoTickInFlight) {
    return { ran: false, reason: 'busy', tickCount: 0, nextTickInMs: 0 };
  }
  runningTick.demoTickInFlight = true;
  try {
    return await runTickInner(options);
  } finally {
    runningTick.demoTickInFlight = false;
  }
}

async function runTickInner(options: { force?: boolean }): Promise<TickResult> {
  const startedAt = Date.now();
  const tickSeconds = getTickSeconds();
  const control = await demoControl();

  const now = new Date();
  const cutoff = new Date(now.getTime() - tickSeconds * 1000);

  // Claim the beat. Without `force`, only a caller arriving after the interval
  // has elapsed wins; everyone else is told how long is left and does nothing.
  const claim = await control.findOneAndUpdate(
    options.force
      ? { _id: CONTROL_ID }
      : { _id: CONTROL_ID, $or: [{ lastTickAt: null }, { lastTickAt: { $lte: cutoff } }] },
    { $set: { lastTickAt: now }, $inc: { tickCount: 1 } },
    { returnDocument: 'after' },
  );

  if (!claim) {
    // Either the demo has not been seeded, or the beat is not due yet.
    const existing = await control.findOne({ _id: CONTROL_ID });
    if (!existing) {
      return { ran: false, reason: 'not-seeded', tickCount: 0, nextTickInMs: 0 };
    }
    const elapsed = existing.lastTickAt ? now.getTime() - existing.lastTickAt.getTime() : 0;
    return {
      ran: false,
      reason: 'not-due',
      tickCount: existing.tickCount ?? 0,
      nextTickInMs: Math.max(0, tickSeconds * 1000 - elapsed),
    };
  }

  // 1. The source system does its thing: engineers travel, finish, new work lands.
  const drip = await dripSourceActivity(getDripPerTick());

  // 2. ProofSync notices what changed and runs the real engine over it.
  const sync = await ingestAndSync();

  return {
    ran: true,
    reason: 'ok',
    tickCount: claim.tickCount ?? 0,
    nextTickInMs: tickSeconds * 1000,
    drip,
    sync,
    durationMs: Date.now() - startedAt,
  };
}

/** Milliseconds until the next beat is claimable, for the console's countdown. */
export async function timeToNextTick(): Promise<{ nextTickInMs: number; tickCount: number; lastTickAt: Date | null }> {
  const control = await demoControl();
  const doc = await control.findOne({ _id: CONTROL_ID });
  if (!doc) return { nextTickInMs: 0, tickCount: 0, lastTickAt: null };
  const elapsed = doc.lastTickAt ? Date.now() - doc.lastTickAt.getTime() : Number.MAX_SAFE_INTEGER;
  return {
    nextTickInMs: Math.max(0, getTickSeconds() * 1000 - elapsed),
    tickCount: doc.tickCount ?? 0,
    lastTickAt: doc.lastTickAt ?? null,
  };
}
