import { demoControl } from './mongo';
import { getTickSeconds, getDripPerTick } from './config';
import { dripSourceActivity, burstCompletedJobs, type DripResult } from './seeder';
import { ingestAndSync, type IngestResult } from './ingest';
import { trimDemo } from './trim';

/** Jobs guaranteed to complete-and-cross on every beat, so nothing feels dead. */
const BASELINE_BURST = 2;

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
/**
 * How long a held lock is trusted before it's treated as abandoned. Longer than
 * any single beat, but short enough that a crashed or hung serverless instance
 * frees the demo quickly rather than jamming everything behind it.
 */
const LOCK_TTL_MS = 20_000;

/**
 * Run one beat, serialised CLUSTER-WIDE.
 *
 * The previous guard was an in-process boolean — useless on serverless, where
 * each request may land on a different instance, so the cron, the console pings
 * and every `force` call ran concurrently and trampled each other (duplicate
 * sync runs, jobs stuck mid-flight). This takes an atomic lock in the control
 * document instead: exactly one beat runs anywhere at a time, `force` included.
 */
export async function runTick(
  options: { force?: boolean; burst?: number } = {},
): Promise<TickResult> {
  const control = await demoControl();
  const now = new Date();
  const lockCutoff = new Date(now.getTime() - LOCK_TTL_MS);

  // Stand down if a reset has asked for a clear window — so it isn't starved by
  // constant beats fighting it for the lock.
  const existingDoc = await control.findOne({ _id: CONTROL_ID });
  if (existingDoc?.pausedUntil && new Date(existingDoc.pausedUntil) > now) {
    return { ran: false, reason: 'paused', tickCount: existingDoc.tickCount ?? 0, nextTickInMs: 0 };
  }

  // Acquire: win only if unlocked or the previous lock has expired. A single
  // conditional findOneAndUpdate is atomic per document, so exactly one caller
  // across all instances can take it.
  const acquired = await control.findOneAndUpdate(
    { _id: CONTROL_ID, $or: [{ lockedAt: null }, { lockedAt: { $lte: lockCutoff } }] },
    { $set: { lockedAt: now } },
    { returnDocument: 'after' },
  );

  if (!acquired) {
    const existing = await control.findOne({ _id: CONTROL_ID });
    if (!existing) return { ran: false, reason: 'not-seeded', tickCount: 0, nextTickInMs: 0 };
    return { ran: false, reason: 'busy', tickCount: existing.tickCount ?? 0, nextTickInMs: 0 };
  }

  try {
    return await runTickInner(options, now);
  } finally {
    await control.updateOne({ _id: CONTROL_ID }, { $set: { lockedAt: null } });
  }
}

/**
 * Run `fn` holding the beat lock, so no sync runs while it executes. Used by
 * reset: wiping the ledger while a beat is mid-sync (adding events to a run
 * being deleted) is what caused the required-relation violations. Waits briefly
 * for an in-flight beat to finish. Returns { ok: false } only if it can't get
 * the lock in time. If the demo isn't seeded yet, no beat can run, so it just
 * proceeds.
 */
export async function runWithDemoLock<T>(fn: () => Promise<T>): Promise<{ ok: boolean; result?: T }> {
  const control = await demoControl();
  const doc = await control.findOne({ _id: CONTROL_ID });
  if (!doc) return { ok: true, result: await fn() };

  // Ask beats to stand down (runTick checks pausedUntil), so we aren't starved
  // for the lock by a fast cadence, then let any in-flight beat finish.
  await control.updateOne(
    { _id: CONTROL_ID },
    { $set: { pausedUntil: new Date(Date.now() + 20_000) } },
  );

  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - LOCK_TTL_MS);
      const acquired = await control.findOneAndUpdate(
        { _id: CONTROL_ID, $or: [{ lockedAt: null }, { lockedAt: { $lte: cutoff } }] },
        { $set: { lockedAt: now } },
        { returnDocument: 'after' },
      );
      if (acquired) {
        try {
          return { ok: true, result: await fn() };
        } finally {
          await control.updateOne({ _id: CONTROL_ID }, { $set: { lockedAt: null } }).catch(() => {});
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return { ok: false };
  } finally {
    // Let beats resume. If fn reseeded the control doc it has no pausedUntil
    // anyway; this is a no-op then.
    await control.updateOne({ _id: CONTROL_ID }, { $set: { pausedUntil: null } }).catch(() => {});
  }
}

async function runTickInner(
  options: { force?: boolean; burst?: number },
  now: Date,
): Promise<TickResult> {
  const startedAt = Date.now();
  const tickSeconds = getTickSeconds();
  const control = await demoControl();

  const existing = await control.findOne({ _id: CONTROL_ID });
  if (!existing) return { ran: false, reason: 'not-seeded', tickCount: 0, nextTickInMs: 0 };

  // Due gate (bypassed by force). We hold the lock, so this check is race-free.
  if (!options.force) {
    const elapsed = existing.lastTickAt
      ? now.getTime() - new Date(existing.lastTickAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (elapsed < tickSeconds * 1000) {
      return {
        ran: false,
        reason: 'not-due',
        tickCount: existing.tickCount ?? 0,
        nextTickInMs: Math.max(0, tickSeconds * 1000 - elapsed),
      };
    }
  }

  const claim = await control.findOneAndUpdate(
    { _id: CONTROL_ID },
    { $set: { lastTickAt: now }, $inc: { tickCount: 1 } },
    { returnDocument: 'after' },
  );

  // 0. Bound everything FIRST, so the rest of the beat operates on a small, fast
  //    set. Trimming used to run LAST — but ingest below mirrors every completed
  //    job in the source, and once the backlog grew into the hundreds that mirror
  //    ate the whole 60s budget and the function was killed before trim ever
  //    committed. So the backlog grew without limit and the target panel filled
  //    with empty work orders. Pruning up front keeps each beat cheap and steady.
  await trimDemo().catch(() => {});

  // 1. Every beat lands a baseline of freshly-completed jobs (plus any explicit
  //    burst from an open/button press), so there is ALWAYS something crossing —
  //    no dead beats where the lifecycle happened to complete nothing.
  const burst = BASELINE_BURST + (options.burst ?? 0);
  await burstCompletedJobs(Math.min(burst, 10));

  // 2. The source system also does its thing: engineers travel, finish, new work
  //    lands — so there's a visible pipeline behind the burst, not just landings.
  const drip = await dripSourceActivity(getDripPerTick());

  // 3. ProofSync notices what changed and runs the real engine over it.
  const sync = await ingestAndSync();

  return {
    ran: true,
    reason: 'ok',
    tickCount: claim?.tickCount ?? 0,
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
