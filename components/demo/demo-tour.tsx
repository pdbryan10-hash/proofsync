'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X, Check } from 'lucide-react';

/**
 * Centered guided tour for the demo shell. Walks a first-time visitor through
 * one job's whole journey, tab by tab — the "Next" button navigates for them so
 * they never have to guess where the result lives. Demo-mode only; dismissable
 * and remembered.
 */

type Step = { path: string; step: string; title: string; body: string };

const TOUR: Step[] = [
  {
    path: '/dashboard',
    step: 'The result',
    title: 'A job just synced itself across.',
    body: 'It was completed once in the contractor’s system and carried into the client’s CAFM automatically. This is the scoreboard: jobs synced, and the admin hours it hands back every month.',
  },
  {
    path: '/jobs',
    step: 'The job',
    title: 'Completed once — now live in their system.',
    body: 'Every job here crossed over automatically. Nobody re-typed it. Open one to see the full sync trail: what moved, both ways, and when.',
  },
  {
    path: '/exceptions',
    step: 'The exceptions',
    title: 'Only what genuinely needs a human.',
    body: 'A missing reference or a rejected upload lands here with the reason in plain English — held for a person, never silently dropped. This is the queue your admin actually works.',
  },
  {
    path: '/enquiries',
    step: 'Demand signal',
    title: 'New work, the other way.',
    body: 'Client enquiries are captured and routed as a signal — so nothing gets lost in an inbox on the way in, either.',
  },
  {
    path: '/integrations',
    step: 'The bridge',
    title: 'The two systems it sits between.',
    body: 'Under the hood: the contractor’s system and each client’s CAFM, connected both ways and synced on a schedule — including the clients with no API at all.',
  },
  {
    path: '/settings',
    step: 'The rules',
    title: 'Set once, then it runs itself.',
    body: 'How fields map between the two systems, and exactly what each client permits. Configure it once and every sync obeys it — no one babysitting.',
  },
];

const KEY = 'ps_demo_tour_v2';

export function DemoTour({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // hidden until storage read

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const index = TOUR.findIndex((s) => pathname === s.path || pathname.startsWith(s.path + '/'));
  const active = demo && !dismissed && index >= 0;

  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to >= TOUR.length) {
        dismiss();
        return;
      }
      router.push(TOUR[to].path);
    },
    [router, dismiss],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      else if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, index, go, dismiss]);

  if (!active) return null;
  const s = TOUR[index];
  const last = index === TOUR.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
      <div className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-amber-300/50 bg-navy-800 text-white shadow-2xl ring-1 ring-black/20">
        {/* progress bar */}
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${((index + 1) / TOUR.length) * 100}%` }}
          />
        </div>
        <div className="p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              Guided tour · {s.step}
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip tour"
              className="rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <h3 className="text-lg font-bold leading-snug text-white">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">{s.body}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {TOUR.map((_, i) => (
                <span
                  key={i}
                  className={
                    'h-1.5 rounded-full transition-all ' +
                    (i === index ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/25')
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={() => go(index + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-navy-900 transition-colors hover:bg-amber-300"
              >
                {last ? (
                  <>
                    Finish <Check className="size-4" />
                  </>
                ) : (
                  <>
                    Next: {TOUR[index + 1].step} <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
