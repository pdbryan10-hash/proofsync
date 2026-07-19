'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { ProofSyncMark } from '@/components/brand/proofsync-logo';

/**
 * The hero: a picture of the PROBLEM, that clears.
 *
 * Not a diagram of software — a picture of a person trapped as the transport layer
 * between two organisations. Defaults to "Without ProofSync": one named human in
 * the middle, every client system feeding into her, the tasks piled around, and
 * the cost as the single biggest thing on the page. Press "With ProofSync" and she
 * slides out of the middle to a small exception queue, the engine takes over, the
 * tasks strike through, and the cost collapses to nothing.
 *
 * The number is the hero; everything else is subordinate. Tension before relief.
 *
 * HONESTY: the £ is a transparent function of the visitor's own volume and a
 * stated, adjustable loaded hourly rate — not an asserted claim.
 */

const CAFMS = [
  'Concerto', 'Elogbooks', 'Planon', 'MRI Evolution', 'QFM', 'Concept Evolution',
  'Corrigo', 'ServiceChannel', 'IBM Maximo', 'Ostara', 'Micad', 'Email + spreadsheet',
];

const MIN_PER_JOB_EACH_END = 10; // ~10 in + ~10 out — the 20-min round trip
const FTE_HOURS_PER_MONTH = 162.5; // 37.5h × 52 ÷ 12
const LOADED_HOURLY = 16; // £/hr, fully-loaded admin cost (≈£31k ÷ 1,950h)
const PERSON = 'Claire';

// The job nobody advertises for — both sides of the re-key.
const TASKS = [
  'watch the portal', 'spot the new job', 'key it in', 'assign it',
  'read the notes', 'work out the time', 'download the cert', 'log into their portal',
  'find the job', 'retype it', 'upload the cert', 'close it',
];

/** Tween an integer toward a target so the cost visibly collapses on toggle. */
function useTween(target: number, ms = 650) {
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
  const [jobs, setJobs] = useState(800);
  // Default to the MESS. `fixed` = the visitor has pressed "With ProofSync".
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

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6e1d6] bg-white shadow-sm">
      {/* Header — the category-creating line + the reveal toggle */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[#e6e1d6] bg-[#faf9f5] px-5 py-3.5 sm:px-7">
        <p className="max-w-md text-sm font-semibold text-[#1a1b1f]">
          {fixed
            ? 'ProofSync is the integration department now — one engine, both ways.'
            : 'Your business has quietly become an integration department.'}
        </p>
        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#e0dbcd] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setFixed(false)}
            aria-pressed={!fixed}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
              !fixed ? 'bg-[#8a3f1c] text-white' : 'text-[#8a8578] hover:text-[#5f6068]'
            }`}
          >
            Without ProofSync
          </button>
          <button
            type="button"
            onClick={() => setFixed(true)}
            aria-pressed={fixed}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
              fixed ? 'bg-[#0e6b3f] text-white' : 'text-[#8a8578] hover:text-[#5f6068]'
            }`}
          >
            With ProofSync
          </button>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* THE PICTURE — a person trapped as the transport layer, or the engine */}
        <div
          className={`relative overflow-hidden rounded-xl border p-4 transition-colors duration-500 sm:p-5 ${
            fixed ? 'border-[#0e6b3f]/25 bg-[#f4f8f5]' : 'border-[#8a3f1c]/25 bg-[#f7efe8]'
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
                  className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-all ${
                    on
                      ? fixed
                        ? 'border-[#0e6b3f] bg-[#e7f0ea] font-semibold text-[#0b5531]'
                        : 'border-[#8a3f1c] bg-[#f0e0d4] font-semibold text-[#8a3f1c]'
                      : 'border-[#e0dbcd] bg-white text-[#b0a894] hover:text-[#5f6068]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* the choreography: Claire in the middle → out to the side; engine in */}
          <div className="relative mt-4 h-[132px]">
            {/* ProofSync engine — fades into the centre with ProofSync */}
            <div
              className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-[#0e6b3f]/40 bg-white px-5 py-3 text-center shadow-sm transition-all duration-500 ${
                fixed ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
              }`}
            >
              <ProofSyncMark className="h-7 w-auto" />
              <span className="mt-1 text-sm font-bold text-[#1a1b1f]">ProofSync</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#0e6b3f]">both ways · audited</span>
            </div>

            {/* Claire — centre + big without; small, off to the left with */}
            <div
              className={`absolute flex items-center gap-2 transition-all duration-500 ${
                fixed
                  ? 'bottom-0 left-0 scale-90'
                  : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-100'
              }`}
            >
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-white transition-all ${
                  fixed ? 'border-[#0e6b3f]/40' : 'border-[#8a3f1c]/50 shadow-[0_0_0_5px_rgba(138,63,28,0.08)]'
                }`}
              >
                <User className={`size-7 ${fixed ? 'text-[#0e6b3f]' : 'text-[#8a3f1c]'}`} />
              </div>
              <div className="max-w-[10rem] text-left">
                <p className={`text-sm font-bold ${fixed ? 'text-[#0b5531]' : 'text-[#8a3f1c]'}`}>{PERSON}</p>
                <p className="text-[11px] leading-tight text-[#5f6068]">
                  {fixed
                    ? 'now on the 2 jobs that need judgement'
                    : `moving work between ${n} system${n === 1 ? '' : 's'}, by hand`}
                </p>
              </div>
            </div>

            {/* the exception queue Claire moves to — appears with ProofSync */}
            <div
              className={`absolute bottom-0 right-0 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 transition-all duration-500 ${
                fixed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
              }`}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 font-mono text-[11px] font-bold text-white">
                2
              </span>
              <span className="text-[11px] font-medium leading-tight text-amber-900">
                need a person<br />everything else flows
              </span>
            </div>
          </div>

          {/* the pile of manual tasks — struck through and faded with ProofSync */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TASKS.map((t) => (
              <span
                key={t}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-all duration-500 ${
                  fixed
                    ? 'text-[#b7c3ba] line-through'
                    : 'border border-[#8a3f1c]/20 bg-white text-[#8a3f1c]'
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* THE HERO NUMBER — nothing else competes with it */}
        <div className="text-center lg:text-left">
          <p
            className={`font-mono text-[10px] uppercase tracking-widest ${fixed ? 'text-[#0e6b3f]' : 'text-[#8a3f1c]'}`}
          >
            {fixed ? 'With ProofSync' : `${PERSON}’s year, by hand`}
          </p>
          <p
            className={`mt-1 font-display text-6xl font-black leading-none tracking-tight tabular-nums transition-colors duration-500 sm:text-7xl ${
              fixed ? 'text-[#0e6b3f]' : 'text-[#8a3f1c]'
            }`}
          >
            £{shownPounds.toLocaleString()}
          </p>
          {fixed ? (
            <>
              <p className="mt-2 text-lg font-semibold text-[#1a1b1f]">That job doesn’t exist any more.</p>
              <p className="mt-1 text-sm text-[#5f6068]">
                The {(Math.round(fte * 10) / 10).toFixed(1)} full-time {fte < 1.5 ? 'person' : 'people'} you spent on
                re-keying — handed back. {PERSON} keeps only the judgement.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-semibold text-[#1a1b1f]">
                ≈ {(Math.round(fte * 10) / 10).toFixed(1)} full-time {fte < 1.5 ? 'person' : 'people'}, just moving data.
              </p>
              <p className="mt-1 text-sm text-[#5f6068]">
                {Math.round(totalH).toLocaleString()} hours a month, retyping what two systems already know.
              </p>
            </>
          )}
        </div>
      </div>

      {/* The slider — with anchors, so a visitor can place themselves */}
      <div className="border-t border-[#e6e1d6] bg-[#faf9f5] px-5 py-4 sm:px-7">
        <div className="flex items-baseline justify-between">
          <label htmlFor="jobs" className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">
            Completed jobs a month
          </label>
          <span className="font-display text-2xl font-bold tabular-nums text-[#1a1b1f]">{jobs.toLocaleString()}</span>
        </div>
        <input
          id="jobs"
          type="range"
          min={100}
          max={5000}
          step={100}
          value={jobs}
          onChange={(e) => setJobs(Number(e.target.value))}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#b0a894]">
          <span>100</span>
          <span className="text-[#8a8578]">typical mid-sized contractor ≈ 800–1,200</span>
          <span>5,000</span>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
          Basis: ~{MIN_PER_JOB_EACH_END} min in + ~{MIN_PER_JOB_EACH_END} min out per job, at ~£{LOADED_HOURLY}/hr
          fully loaded — your rate, your call. Connector availability and direction vary by platform and by your
          client’s authorisation.
        </p>
      </div>
    </div>
  );
}
