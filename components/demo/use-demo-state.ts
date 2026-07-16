'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoState } from '@/lib/demo/state';

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
  const mounted = useRef(true);

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
    async (force = false) => {
      try {
        const res = await fetch(`/api/demo/tick${force ? '?force=1' : ''}`, {
          method: 'POST',
          cache: 'no-store',
        });
        const body = await res.json();
        // A beat that actually ran changed data — read it back immediately
        // rather than waiting for the next poll, so the console reacts on the beat.
        if (body?.ok && body.data?.ran) await refresh();
      } catch {
        // Silent: the read loop already surfaces connectivity problems.
      }
    },
    [refresh],
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

  const forceTick = useCallback(async () => {
    setBusy(true);
    try {
      await tick(true);
      await refresh();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [tick, refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    void tick();
    const readLoop = setInterval(() => void refresh(), 2_000);
    const tickLoop = setInterval(() => void tick(), 5_000);
    return () => {
      mounted.current = false;
      clearInterval(readLoop);
      clearInterval(tickLoop);
    };
  }, [refresh, tick]);

  return { state, error, busy, refresh, reset, forceTick };
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
