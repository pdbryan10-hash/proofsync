'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, User, ShieldCheck } from 'lucide-react';
import { ProofSyncMark } from '@/components/brand/proofsync-logo';

/**
 * The centrepiece: the fan-out hub AND the calculator, as one thing.
 *
 * The thesis a contractor can't be told in a sentence — that they run a manual
 * integration layer between one field system and every client CAFM, in BOTH
 * directions — made visible and made theirs. They pick the client systems they
 * actually feed; the spokes populate; the hours and headcount update in their own
 * numbers, counting the re-keying at both ends (job in, completion out).
 *
 * HONESTY: this shows the landscape and the shape of the engine, NOT a claim that
 * any specific pairing is live in either direction. Availability is stated plainly
 * beneath, exactly as the connector strip does. The brand is "Proof".
 */

// A legible fan — the recognisable ones a UK FM contractor actually meets. Kept
// to a dozen on purpose: beyond that the one-to-many shape turns to logo soup.
const CAFMS = [
  'Concerto', 'Elogbooks', 'Planon', 'MRI Evolution', 'QFM', 'Concept Evolution',
  'Corrigo', 'ServiceChannel', 'IBM Maximo', 'Ostara', 'Micad', 'CAFM Explorer',
];

const MIN_PER_JOB_EACH_END = 10; // same 10-min basis as the rest of the site
const FTE_HOURS_PER_MONTH = 162.5; // 37.5h × 52 ÷ 12

export function FanOutHub() {
  // A believable starting point a contractor recognises, then makes their own.
  const [selected, setSelected] = useState<string[]>(['Concerto', 'Elogbooks', 'MRI Evolution']);
  const [jobs, setJobs] = useState(800);
  const [before, setBefore] = useState(false);

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const { intakeH, completeH, totalH, fte } = useMemo(() => {
    const intake = (jobs * MIN_PER_JOB_EACH_END) / 60;
    const complete = (jobs * MIN_PER_JOB_EACH_END) / 60;
    const total = intake + complete;
    return { intakeH: intake, completeH: complete, totalH: total, fte: total / FTE_HOURS_PER_MONTH };
  }, [jobs]);

  const n = selected.length;

  return (
    <div className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm sm:p-7">
      {/* Header + before/after toggle */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0e6b3f]/25 bg-[#e7f0ea] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0e6b3f] opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#0e6b3f]" />
            </span>
            One engine · both directions
          </span>
          <span className="text-sm text-[#5f6068]">Every client system you feed, one hub — in and out.</span>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[#e0dbcd] bg-[#f7f5ef] p-0.5">
          <button
            type="button"
            onClick={() => setBefore(true)}
            aria-pressed={before}
            className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold transition-colors ${before ? 'bg-[#8a3f1c] text-white' : 'text-[#8a8578] hover:text-[#5f6068]'}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setBefore(false)}
            aria-pressed={!before}
            className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold transition-colors ${!before ? 'bg-[#0e6b3f] text-white' : 'text-[#8a8578] hover:text-[#5f6068]'}`}
          >
            With ProofSync
          </button>
        </div>
      </div>

      {/* THE HUB */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.5fr)] lg:gap-3">
        {/* LEFT — your field system */}
        <div className="flex flex-col justify-center rounded-xl border border-[#e6e1d6] bg-[#f7f5ef] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Your field system</p>
          <p className="mt-1 text-lg font-bold text-[#1a1b1f]">Whatever you run</p>
          <p className="mt-2 text-xs leading-relaxed text-[#5f6068]">
            Joblogic, Simpro, BigChange, Commusoft — where your engineers complete the work, once.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[#0e6b3f]">
            <ArrowLeft className="size-3.5" /> jobs in
            <span className="mx-1 text-[#cfc9ba]">·</span>
            completions out <ArrowRight className="size-3.5" />
          </div>
        </div>

        {/* CENTRE — the engine (or the human, in "Today") */}
        <div className="relative flex items-center justify-center py-1 lg:py-0">
          {before ? (
            <div className="relative rounded-2xl border border-[#8a3f1c]/40 bg-[#f6ece2] px-6 py-6 text-center">
              <User className="mx-auto size-8 text-[#8a3f1c]" />
              <p className="mt-2 text-sm font-bold text-[#8a3f1c]">A person</p>
              <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-wider text-[#8a3f1c]/80">
                re-keys<br />both ways<br />all day
              </p>
            </div>
          ) : (
            <div className="relative">
              <span className="ps-ring pointer-events-none absolute inset-0 rounded-2xl border border-[#0e6b3f]/30" />
              <div className="ps-engine-glow relative rounded-2xl border border-[#0e6b3f]/40 bg-white px-6 py-6 text-center">
                <ProofSyncMark className="mx-auto h-8 w-auto" />
                <p className="mt-2 text-sm font-bold text-[#1a1b1f]">ProofSync</p>
                <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-widest text-[#0e6b3f]">
                  receive · create<br />complete · return<br />verify
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-1 border-t border-[#e6e1d6] pt-2.5">
                  <ShieldCheck className="size-3 text-[#0e6b3f]" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#8a8578]">audited</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — the fan of client systems (selectable) */}
        <div className="relative overflow-hidden rounded-xl border border-[#e6e1d6] bg-[#f7f5ef] p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#0e6b3f]/[0.06] blur-3xl" />
          <div className="relative flex items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Your clients&apos; systems</p>
              <p className="mt-1 text-sm font-semibold text-[#1a1b1f]">Tap the ones you feed</p>
            </div>
            <p className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#0e6b3f]">
              {n} selected
            </p>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-1.5">
            {CAFMS.map((c) => {
              const on = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={on}
                  className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-all ${
                    on
                      ? 'border-[#0e6b3f] bg-[#e7f0ea] font-semibold text-[#0e6b3f] shadow-sm'
                      : 'border-[#e0dbcd] bg-white text-[#8a8578] hover:border-[#0e6b3f]/40 hover:text-[#0e6b3f]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
            <span className="inline-flex items-center rounded-md border border-dashed border-[#0e6b3f]/40 px-2.5 py-1.5 font-mono text-[11px] text-[#0e6b3f]">
              + the next one you win
            </span>
          </div>
        </div>
      </div>

      {/* THE CALCULATOR — their operation, in their numbers */}
      <div className="mt-5 grid gap-4 rounded-xl border border-[#e6e1d6] bg-[#faf9f5] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <label htmlFor="jobs" className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">
            Completed jobs a month
          </label>
          <div className="mt-2 flex items-center gap-4">
            <input
              id="jobs"
              type="range"
              min={100}
              max={5000}
              step={100}
              value={jobs}
              onChange={(e) => setJobs(Number(e.target.value))}
              className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
            />
            <span className="w-20 font-display text-2xl font-bold tabular-nums text-[#1a1b1f]">
              {jobs.toLocaleString()}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#5f6068]">
            Across <strong className="text-[#1a1b1f]">{n} client system{n === 1 ? '' : 's'}</strong>, that&apos;s{' '}
            <strong className="text-[#1a1b1f]">{jobs.toLocaleString()} jobs in</strong> and{' '}
            <strong className="text-[#1a1b1f]">{jobs.toLocaleString()} completions out</strong> — today, by hand.
          </p>
        </div>

        <div className="rounded-lg border border-[#0e6b3f]/25 bg-[#e7f0ea] px-6 py-4 text-center">
          <p className="font-display text-4xl font-black leading-none text-[#0e6b3f]">
            {Math.round(totalH).toLocaleString()}
            <span className="text-xl"> hrs</span>
          </p>
          <p className="mt-1 text-xs font-medium text-[#0b5531]">of re-keying, every month</p>
          <p className="mt-2 border-t border-[#0e6b3f]/15 pt-2 text-sm font-bold text-[#1a1b1f]">
            ≈ {fte.toFixed(1)} full-time admin{fte >= 2 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Basis + honesty — the numbers survive being checked */}
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
        Basis: {MIN_PER_JOB_EACH_END} min in + {MIN_PER_JOB_EACH_END} min out per job
        ({Math.round(intakeH)} + {Math.round(completeH)} hrs). Both ends removed. Connector availability and
        direction vary by platform and by your client&apos;s authorisation — ask us about yours.
      </p>
    </div>
  );
}
