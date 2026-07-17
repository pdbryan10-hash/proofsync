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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/demo/state', { cache: 'no-store' });
      const body = await res.json();
      if (!mounted.current) return;
      if (!body.ok) {
        setError(body.error ?? 'Could not read the demo state.');
        return;
      }
      setError(null);
      setState(body.data as DemoState);
    } catch {
      if (mounted.current) setError('Lost contact with the server.');
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
      await refresh();
      // Kick the batch straight away so it starts crossing live rather than
      // waiting for the next poll-driven beat.
      await tick({ force: true });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [refresh, tick]);

  const forceTick = useCallback(async () => {
    setBusy(true);
    try {
      // Pressing the button injects a fresh batch so a burst of real jobs lands
      // on cue, rather than syncing only whatever happens to be pending.
      await tick({ force: true, burst: 5 });
      await refresh();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [tick, refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // Land a burst of real jobs the instant the page opens, so a visitor sees
    // records crossing within a second or two — not an idle screen.
    void tick({ force: true, burst: 6 });
    // Poll for movement, and ping the sync gate. Kept modest so many open tabs
    // don't spin up a swarm of serverless instances (each opens DB connections);
    // the server gates the actual cadence anyway.
    const readLoop = setInterval(() => void refresh(), 1_000);
    const tickLoop = setInterval(() => void tick(), 2_000);
    return () => {
      mounted.current = false;
      clearInterval(readLoop);
      clearInterval(tickLoop);
    };
  }, [refresh, tick]);

  return { state, error, busy, activity, refresh, reset, forceTick, resolve, replay };
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
