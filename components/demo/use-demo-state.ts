'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoState } from '@/lib/demo/state';

export interface ActivityLine {
  id: number;
  time: string;
  text: string;
  tone: 'ok' | 'flag' | 'idle';
}

/**
 * Turn one sync's raw result into a plain-English sentence a stranger can follow.
 * Returns null when nothing worth narrating happened, so the log doesn't fill
 * with "checked, nothing new" every 30 seconds.
 */
function narrate(data: {
  drip?: { completed?: number };
  sync?: { synced?: number; partial?: number; exceptions?: number };
}): { text: string; tone: ActivityLine['tone'] } | null {
  const completed = data.drip?.completed ?? 0;
  const synced = data.sync?.synced ?? 0;
  const partial = data.sync?.partial ?? 0;
  const exceptions = data.sync?.exceptions ?? 0;

  if (completed === 0 && synced === 0 && partial === 0 && exceptions === 0) return null;

  const parts: string[] = [];
  if (completed > 0) parts.push(`${completed} job${completed === 1 ? '' : 's'} just finished on site`);
  if (synced > 0) parts.push(`copied ${synced} into Concerto and verified ${synced === 1 ? 'it' : 'them'}`);
  if (partial > 0) parts.push(`${partial} copied with a document still to follow`);
  if (exceptions > 0)
    parts.push(`${exceptions} sent to a person to check (usually a missing client reference)`);

  const tone: ActivityLine['tone'] = exceptions > 0 && synced === 0 ? 'flag' : 'ok';
  return { text: `Checked Joblogic — ${parts.join('; ')}.`, tone };
}

/**
 * Drives the live console.
 *
 * Two separate loops, deliberately:
 *   - READ every 2s, so the panels track reality closely.
 *   - TICK every 5s, which is FASTER than the 30s beat on purpose. The server
 *     claims the beat atomically and turns early callers away, so pinging often
 *     costs one cheap query and guarantees the beat fires the moment it is due —
 *     rather than up to 5s late, or twice because two tabs are open.
 *
 * This is how a 30-second cadence is delivered at all: Vercel Cron's floor is one
 * minute, so the beat cannot come from a schedule. It comes from whoever is
 * asking, gated by the server.
 */
export function useDemoState() {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityLine[]>([]);
  const mounted = useRef(true);
  const lineId = useRef(0);

  const pushActivity = useCallback((line: { text: string; tone: ActivityLine['tone'] }) => {
    const time = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setActivity((prev) => [{ id: lineId.current++, time, ...line }, ...prev].slice(0, 8));
  }, []);

  const refresh = useCallback(async (): Promise<DemoState | null> => {
    try {
      const res = await fetch('/api/demo/state', { cache: 'no-store' });
      const body = await res.json();
      if (!mounted.current) return null;
      if (!body.ok) {
        setError(body.error ?? 'Could not read the demo state.');
        return null;
      }
      setError(null);
      setState(body.data as DemoState);
      return body.data as DemoState;
    } catch {
      if (mounted.current) setError('Lost contact with the server.');
      return null;
    }
  }, []);

  const tick = useCallback(
    async (opts: { force?: boolean; burst?: number } = {}) => {
      try {
        const qs = new URLSearchParams();
        if (opts.force) qs.set('force', '1');
        if (opts.burst) qs.set('burst', String(opts.burst));
        const res = await fetch(`/api/demo/tick${qs.toString() ? `?${qs}` : ''}`, {
          method: 'POST',
          cache: 'no-store',
        });
        const body = await res.json();
        // A sync that actually ran changed data — read it back immediately rather
        // than waiting for the next poll, and narrate what it did in plain English.
        if (body?.ok && body.data?.ran) {
          const line = narrate(body.data);
          if (line) pushActivity(line);
          await refresh();
        }
      } catch {
        // Silent: the read loop already surfaces connectivity problems.
      }
    },
    [refresh, pushActivity],
  );

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST', cache: 'no-store' });
      await refresh();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);

  const resolve = useCallback(
    async (reference: string, value: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/demo/exceptions/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ reference, value }),
        });
        const body = await res.json();
        if (body?.ok) {
          pushActivity({ text: `A coordinator resolved ${reference} — resubmitting to Concerto.`, tone: 'ok' });
          await refresh();
          return { ok: true };
        }
        return { ok: false, error: body?.error ?? 'Could not resolve that job.' };
      } catch {
        return { ok: false, error: 'Lost contact with the server.' };
      }
    },
    [refresh, pushActivity],
  );

  const replay = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/demo/replay', { method: 'POST', cache: 'no-store' });
      // Refresh only — do NOT kick a beat here. The floor should open showing the
      // Joblogic jobs loaded and Concerto empty; the cadence then trickles them
      // across a few at a time, rather than a whole batch flashing "synced" at once.
      await refresh();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);

  const setTransport = useCallback(
    async (transport: 'direct' | 'browser'): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/demo/transport', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ transport }),
        });
        const body = await res.json();
        await refresh();
        return body?.ok ? { ok: true } : { ok: false, error: body?.error ?? 'Could not switch mode.' };
      } catch {
        return { ok: false, error: 'Lost contact with the server.' };
      }
    },
    [refresh],
  );

  /**
   * Run the real-browser login for an act opener, resolving when the sign-in has
   * finished (~20s). The live-view URL to embed appears within a few seconds via
   * the state poll (state.browserProof); this promise is what tells the console
   * the login is done and it can hand off to the fast sync.
   */
  const runLogin = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/demo/browser-proof', { method: 'POST', cache: 'no-store' });
    } catch {
      // The console still proceeds — a failed proof must not block the demo.
    }
    await refresh();
  }, [refresh]);

  /**
   * Drive the whole closed loop and report each stage as it happens: the client's
   * raised jobs are pulled into Joblogic (intake), completed by the engineer, then
   * synced back to the client and verified (outbound). The visible Receive → Create
   * → Complete → Return → Verify story.
   */
  const runClosedLoop = useCallback(
    async (onStage: (s: 'intake' | 'complete' | 'sync' | 'done') => void) => {
      const allBack = (st: DemoState | null) =>
        !!st && st.inbound.dispatched > 0 && st.inbound.returned >= st.inbound.dispatched;
      try {
        onStage('intake');
        const ir = await fetch('/api/demo/intake', { method: 'POST', cache: 'no-store' });
        const created = (await ir.json().catch(() => null))?.data?.created ?? 0;
        if (created > 0) {
          pushActivity({
            text: `Polled your clients' systems — ${created} new job${created === 1 ? '' : 's'} received and created in your system, client reference kept.`,
            tone: 'ok',
          });
        }
        await refresh();
        await new Promise((r) => setTimeout(r, 1100));

        onStage('complete');
        await fetch('/api/demo/complete-intake', { method: 'POST', cache: 'no-store' });
        pushActivity({ text: `Engineers completed the raised jobs on site.`, tone: 'ok' });
        await refresh();
        await new Promise((r) => setTimeout(r, 1100));

        onStage('sync');
        for (let i = 0; i < 18; i++) {
          await fetch('/api/demo/tick?force=1', { method: 'POST', cache: 'no-store' });
          const st = await refresh();
          if (allBack(st)) break;
          await new Promise((r) => setTimeout(r, 400));
        }
        onStage('done');
      } catch {
        onStage('done');
      }
    },
    [refresh, pushActivity],
  );

  const forceTick = useCallback(async () => {
    setBusy(true);
    try {
      // Sync whatever is pending — do NOT inject new jobs (burst), which inflated
      // the batch past its fixed 10 and left the ledger churning with retries.
      await tick({ force: true });
      await refresh();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [tick, refresh]);

  /**
   * Drive the (re-queued) batch to completion at a watchable machine pace.
   *
   * Act 2 owns its run rather than leaning on the 30s background cadence: after a
   * replay re-queues all jobs PENDING, this forces beats a beat at a time with a
   * short gap, so a viewer actually watches the jobs cross — instead of the batch
   * being already done (or finishing in one invisible flash) by the time they look.
   * Stops as soon as a beat has nothing left to do.
   */
  const runMachineBatch = useCallback(async () => {
    // Drive until the batch is genuinely drained. The break is on the ACTUAL
    // awaiting count, never on a single beat reporting nothing — a beat can report
    // nothing simply because the previous beat still holds the cluster lock while
    // its syncs finish (they overlap), which is not "done". Looping past those and
    // checking awaiting is what stops the run bailing early and leaving jobs behind.
    // Awaiting the beat is what paces this: a beat that actually runs blocks for
    // its syncs (a few seconds on the free cluster), so a short gap is enough and
    // beats don't stack. Generous iteration cap so the whole batch drains even
    // when the cluster is slow; the loop still exits the instant awaiting hits 0.
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('/api/demo/tick?force=1', { method: 'POST', cache: 'no-store' });
        const body = await res.json();
        const line = narrate(body?.data ?? {});
        if (line) pushActivity(line);
      } catch {
        // transient — keep going
      }
      // A visible pause between waves, so a batch of jobs lands, you see it, then
      // the next wave comes — rather than everything flashing done at once.
      await new Promise((r) => setTimeout(r, 900));
      const st = await refresh();
      if (st && st.stats.awaitingSync === 0) break;
    }
  }, [refresh, pushActivity]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // Deliberately do NOT auto-sync on load. The batch is seeded and STAYS put
    // until the presenter runs it (Act 1 spotlight, then Act 2 machine run), so a
    // fresh page never opens with the jobs already "Success". Only read.
    const readLoop = setInterval(() => void refresh(), 1_000);
    return () => {
      mounted.current = false;
      clearInterval(readLoop);
    };
  }, [refresh]);

  return { state, error, busy, activity, refresh, reset, forceTick, resolve, replay, setTransport, runLogin, runMachineBatch, runClosedLoop };
}

/**
 * Flags rows whose contents changed since the last poll, so the UI can flash
 * them. Keyed on a caller-supplied version string (an updatedAt, a status) —
 * anything that changes when the record does.
 */
export function useChangedRows(versions: Record<string, string>, holdMs = 2_500) {
  const previous = useRef<Record<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const first = previous.current === null;
    const before = previous.current ?? {};
    const hits: string[] = [];

    for (const [key, version] of Object.entries(versions)) {
      // A row appearing on the very first render is not a change — without this
      // the whole console flashes on load and the signal means nothing.
      if (!first && before[key] !== version) hits.push(key);
    }
    previous.current = { ...versions };

    if (hits.length === 0) return;

    setChanged((current) => {
      const next = new Set(current);
      hits.forEach((k) => next.add(k));
      return next;
    });

    for (const key of hits) {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => {
          setChanged((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
          timers.current.delete(key);
        }, holdMs),
      );
    }
  }, [versions, holdMs]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  return changed;
}
