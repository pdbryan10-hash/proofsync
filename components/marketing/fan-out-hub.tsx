'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, User } from 'lucide-react';
import { ProofSyncMark } from '@/components/brand/proofsync-logo';

/**
 * The hero: a picture of the PROBLEM, that clears — loud on purpose.
 *
 * Defaults to "Today": Claire trapped as the transport layer between every client
 * system, the manual tasks stacking up one after another (feel the repetition),
 * the cost as the single biggest thing. One big, obvious button flips it: she
 * slides out to a small exception queue, the engine takes the middle, the pile
 * collapses to just "review exception / approve", and the cost tweens to nothing.
 *
 * The work is the villain, never Claire. HONESTY: the £ is a transparent function
 * of the visitor's own volume and a stated, adjustable loaded rate — not a claim.
 */

const CAFMS = [
  'Concerto', 'Elogbooks', 'Planon', 'MRI Evolution', 'QFM', 'Concept Evolution',
  'Corrigo', 'ServiceChannel', 'IBM Maximo', 'Ostara', 'Micad', 'Email + spreadsheet',
];

const MIN_PER_JOB_EACH_END = 10; // ~10 in + ~10 out — the 20-min round trip
const FTE_HOURS_PER_MONTH = 162.5; // 37.5h × 52 ÷ 12
const LOADED_HOURLY = 19; // £/hr, a ~£28k admin fully loaded (~£37k ÷ 1,950h)
const PERSON = 'Claire';

// The job nobody advertises for — both sides of the re-key, stacked one by one.
const TASKS = [
  'watch the portal', 'spot the new job', 'key it in', 'assign it',
  'read the notes', 'work out the time', 'download the cert', 'log into their portal',
  'find the job', 'retype it', 'upload the cert', 'close it',
];
// All that's left once the transport layer is gone.
const KEPT = ['review the exception', 'approve'];

/** Tween an integer toward a target so the cost visibly collapses on toggle. */
function useTween(target: number, ms = 1400) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (target - from) * eased);
      setValue(cur);
      fromRef.current = cur;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function FanOutHub() {
  const [selected, setSelected] = useState<string[]>(['Concerto', 'Elogbooks', 'MRI Evolution']);
  const [jobs, setJobs] = useState(1200);
  // Default to TODAY (the mess). `fixed` = the visitor has pressed the button.
  const [fixed, setFixed] = useState(false);

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const { totalH, fte, poundsYear } = useMemo(() => {
    const total = (jobs * MIN_PER_JOB_EACH_END * 2) / 60;
    return {
      totalH: total,
      fte: total / FTE_HOURS_PER_MONTH,
      poundsYear: Math.round(total * 12 * LOADED_HOURLY),
    };
  }, [jobs]);

  const shownPounds = useTween(fixed ? 0 : poundsYear);
  const n = selected.length;
  const people = (Math.round(fte * 10) / 10).toFixed(1);
  const isPlural = fte >= 1.5;

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-lg transition-colors duration-700 ${
        fixed ? 'border-[#0e6b3f]/40 bg-white' : 'border-[#9f1239]/40 bg-white'
      }`}
    >
      <style>{`
        @keyframes psChipIn { from { opacity:0; transform: translateY(7px) scale(.92) } to { opacity:1; transform:none } }
        .ps-chip { animation: psChipIn .34s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce){ .ps-chip{ animation:none } }
      `}</style>

      {/* Header — the category line + a live "right now" tension marker */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3.5 transition-colors duration-700 sm:px-7 ${
          fixed ? 'border-[#0e6b3f]/15 bg-[#f4f8f5]' : 'border-[#9f1239]/15 bg-[#faf7f6]'
        }`}
      >
        <p className="max-w-xl text-sm font-semibold text-[#1a1b1f] sm:text-base">
          {fixed
            ? 'Now you have one — ProofSync. One engine, both ways.'
            : 'You didn’t build an integration department. You just woke up with one.'}
        </p>
        {!fixed && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9f1239]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#9f1239] opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-[#9f1239]" />
            </span>
            happening right now
          </span>
        )}
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* THE PICTURE — a person trapped as the transport layer, or the engine */}
        <div
          className={`relative overflow-hidden rounded-xl border p-4 transition-colors duration-700 sm:p-5 ${
            fixed ? 'border-[#0e6b3f]/30 bg-[#eef6f0]' : 'border-[#9f1239]/30 bg-[#faf7f6]'
          }`}
        >
          {/* the client systems, all issuing work */}
          <div className="flex flex-wrap gap-1.5">
            {CAFMS.map((c) => {
              const on = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={on}
                  className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-all duration-500 ${
                    on
                      ? fixed
                        ? 'border-[#0e6b3f] bg-[#e7f0ea] font-semibold text-[#0b5531]'
                        : 'border-[#9f1239] bg-[#f4e6ea] font-semibold text-[#9f1239] shadow-sm'
                      : 'border-black/10 bg-white/70 text-[#b0a894] hover:text-[#5f6068]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* the choreography: Claire in the middle → out to the side; engine in.
              Deliberately slow (~1.1s) so the movement is watchable. */}
          <div className="relative mt-4 h-[136px]">
            <div
              className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border-2 border-[#0e6b3f]/45 bg-white px-6 py-3.5 text-center shadow-md transition-all duration-[1100ms] ease-in-out ${
                fixed ? 'scale-100 opacity-100 delay-200' : 'pointer-events-none scale-[0.6] opacity-0'
              }`}
            >
              <ProofSyncMark className="h-8 w-auto" />
              <span className="mt-1 text-sm font-bold text-[#1a1b1f]">ProofSync</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#0e6b3f]">both ways · audited</span>
            </div>

            <div
              className={`absolute flex items-center gap-2 transition-all duration-[1100ms] ease-in-out ${
                fixed
                  ? 'bottom-0 left-0 scale-90'
                  : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-110'
              }`}
            >
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-white transition-all duration-700 ${
                  fixed ? 'border-[#0e6b3f]/40' : 'border-[#9f1239]/60 shadow-[0_0_0_6px_rgba(159,18,57,0.12)]'
                }`}
              >
                <User className={`size-7 ${fixed ? 'text-[#0e6b3f]' : 'text-[#9f1239]'}`} />
              </div>
              <div className="max-w-[10rem] text-left">
                <p className={`text-sm font-bold ${fixed ? 'text-[#0b5531]' : 'text-[#9f1239]'}`}>{PERSON}</p>
                <p className="text-[11px] leading-tight text-[#5f6068]">
                  {fixed
                    ? 'now on the jobs that need judgement'
                    : `moving work between ${n} system${n === 1 ? '' : 's'}, by hand`}
                </p>
              </div>
            </div>

            <div
              className={`absolute bottom-0 right-0 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 transition-all duration-[1100ms] ease-in-out ${
                fixed ? 'translate-y-0 opacity-100 delay-500' : 'pointer-events-none translate-y-3 opacity-0'
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-bold text-white">
                2
              </span>
              <span className="text-[11px] leading-tight text-amber-900">
                <strong>jobs need a person</strong>
                <br />
                the rest flow automatically
              </span>
            </div>
          </div>

          {/* the pile stacks one by one (Today) → collapses to just the judgement */}
          <div className="mt-3 min-h-[3.25rem]">
            <div className="flex flex-wrap gap-1.5">
              {(fixed ? KEPT : TASKS).map((t, i) => (
                <span
                  key={t}
                  className={`ps-chip rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                    fixed
                      ? 'border-[#0e6b3f]/30 bg-[#e7f0ea] font-semibold text-[#0b5531]'
                      : 'border-[#9f1239]/20 bg-white/80 text-[#9f1239]'
                  }`}
                  style={{ animationDelay: `${i * (fixed ? 160 : 95)}ms` }}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className={`mt-2 text-[11px] font-medium ${fixed ? 'text-[#0b5531]' : 'text-[#9f1239]'}`}>
              {fixed
                ? `${PERSON} stays — she just isn’t the transport layer any more.`
                : `${PERSON} isn’t the problem. Her job is — she was hired to support your contracts, not to be the bridge between your software and your clients’.`}
            </p>
          </div>
        </div>

        {/* THE HERO NUMBER — nothing else competes with it */}
        <div className="text-center lg:text-left">
          <p
            className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${
              fixed ? 'text-[#0e6b3f]' : 'text-[#9f1239]'
            }`}
          >
            {fixed ? 'With ProofSync' : 'Today, by hand — a year'}
          </p>
          <p
            className={`mt-1 font-display text-7xl font-black leading-[0.95] tracking-tight tabular-nums transition-colors duration-700 sm:text-8xl ${
              fixed ? 'text-[#0e6b3f]' : 'text-[#9f1239]'
            }`}
          >
            £{shownPounds.toLocaleString()}
          </p>
          {fixed ? (
            <>
              <p className="mt-3 text-xl font-bold leading-snug text-[#1a1b1f]">That job doesn’t exist any more.</p>
              <p className="mt-1.5 text-sm text-[#5f6068]">
                The {people} full-time {isPlural ? 'people' : 'person'} you spent on re-keying — handed back to quality,
                winning more work, and looking after clients.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-bold leading-snug text-[#9f1239] sm:text-2xl">
                spent moving information that already exists.
              </p>
              <p className="mt-2 text-base text-[#1a1b1f]">
                ≈ {people} full-time {isPlural ? 'people' : 'person'}. {Math.round(totalH).toLocaleString()} hours a
                month, <span className="font-semibold">retyping what two systems already know.</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* THE BUTTON — big, loud, impossible to miss */}
      <div className="px-5 pb-5 sm:px-7">
        <button
          type="button"
          onClick={() => setFixed((v) => !v)}
          className={`group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl px-6 py-5 text-lg font-bold text-white shadow-xl transition-all duration-300 hover:scale-[1.01] sm:text-xl ${
            fixed ? 'bg-[#9f1239] shadow-[#9f1239]/25' : 'bg-[#0e6b3f] shadow-[#0e6b3f]/30'
          }`}
        >
          {!fixed && (
            <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl ring-1 ring-white/25" />
          )}
          {fixed ? (
            <>
              <RotateCcw className="size-5" />
              Rewind — show me today, by hand
            </>
          ) : (
            <>
              See the same business with ProofSync
              <ArrowRight className="size-6 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>

      {/* THE SLIDER — prominent; you're not changing jobs, you're changing payroll */}
      <div className="border-t border-[#e6e1d6] bg-[#faf9f5] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="jobs" className="text-sm font-semibold text-[#1a1b1f]">
            How many jobs do you complete a month?
          </label>
          <span className="font-display text-3xl font-black tabular-nums text-[#0e6b3f]">{jobs.toLocaleString()}</span>
        </div>
        <input
          id="jobs"
          type="range"
          min={100}
          max={5000}
          step={100}
          value={jobs}
          onChange={(e) => setJobs(Number(e.target.value))}
          className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
        />
        <div className="mt-2 flex justify-between font-mono text-[10px] text-[#b0a894]">
          <span>100</span>
          <span className="text-[#8a8578]">typical mid-sized contractor ≈ 800–1,200</span>
          <span>5,000</span>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
          Basis: ~{MIN_PER_JOB_EACH_END} min in + ~{MIN_PER_JOB_EACH_END} min out per job. Rate ~£{LOADED_HOURLY}/hr,
          derived: a £28k admin + £3,450 employer NI + £653 auto-enrolment pension = £32,100 direct, ×1.25–1.4 fully
          loaded (kit, software, space, cover) ≈ £35–39k ÷ 1,950 hrs. Your rate, your call — every figure is yours to
          change. Connector availability and direction vary by platform and by your client’s authorisation.
        </p>
      </div>
    </div>
  );
}
