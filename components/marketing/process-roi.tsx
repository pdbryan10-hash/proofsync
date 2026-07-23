'use client';

import { useMemo, useState } from 'react';

/**
 * Built-in ROI calculator for the private delivery page. Ties the price straight
 * to the removed cost, so the fee justifies itself: staged build + banded run
 * against the labour it takes out, with payback and benefit-retained shown.
 */

const MIN_PER_JOB = 20; // ~10 in + ~10 out, the round trip
const POC = 2500;
const FIRST_CONNECTOR = 6000;
const NEXT_CONNECTOR = 2750; // midpoint of £2,500–3,000

function subscriptionBand(jobs: number): { band: string; monthly: number } {
  if (jobs <= 1000) return { band: 'Starter', monthly: 1250 };
  if (jobs <= 4000) return { band: 'Growth', monthly: 2500 };
  return { band: 'Scale', monthly: 4500 };
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`;

export function ProcessRoi() {
  const [jobs, setJobs] = useState(1000);
  const [rate, setRate] = useState(19);
  const [connectors, setConnectors] = useState(3);

  const m = useMemo(() => {
    const removedYr = (jobs * MIN_PER_JOB / 60) * 12 * rate;
    const { band, monthly } = subscriptionBand(jobs);
    const subYr = monthly * 12;
    const build = POC + FIRST_CONNECTOR + Math.max(0, connectors - 1) * NEXT_CONNECTOR;
    const year1 = build + subYr;
    const netYr1 = removedYr - year1;
    // Payback = the one-off BUILD ÷ the NET monthly benefit (gross monthly saving
    // minus the monthly run fee). The run fee is ongoing, not a payback hurdle —
    // dividing the whole year-1 outlay by the gross saving double-counts it.
    const netMonthly = (removedYr - subYr) / 12;
    const paybackMonths = netMonthly > 0 ? build / netMonthly : Infinity;
    // Benefit retained in a STEADY-STATE year (removed − run), once the build is
    // behind you. Labelled as ongoing so it isn't read as the year-1 figure.
    const retained = removedYr > 0 ? (removedYr - subYr) / removedYr : 0;
    // Cumulative net after fees: year 1 carries the one-off build, years 2–5 are
    // run only, so the curve steepens.
    const years = [1, 2, 3, 4, 5].map((k) => ({ year: k, net: removedYr * k - (build + subYr * k) }));
    const fiveYearNet = years[4]!.net;
    return { removedYr, band, monthly, subYr, build, year1, netYr1, paybackMonths, retained, years, fiveYearNet };
  }, [jobs, rate, connectors]);

  return (
    <div className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Inputs */}
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="roi-jobs" className="text-sm font-semibold text-[#1a1b1f]">Completed jobs a month</label>
              <span className="font-display text-2xl font-black tabular-nums text-[#0e6b3f]">{jobs.toLocaleString()}</span>
            </div>
            <input
              id="roi-jobs"
              type="range"
              min={100}
              max={5000}
              step={100}
              value={jobs}
              onChange={(e) => setJobs(Number(e.target.value))}
              className="mt-2 h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
            />
            <p className="mt-1 font-mono text-[10px] text-[#8a8578]">
              {m.band} band · {gbp(m.monthly)}/mo
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="roi-conn" className="text-sm font-semibold text-[#1a1b1f]">Client systems to connect</label>
              <span className="font-display text-2xl font-black tabular-nums text-[#0e6b3f]">{connectors}</span>
            </div>
            <input
              id="roi-conn"
              type="range"
              min={1}
              max={12}
              step={1}
              value={connectors}
              onChange={(e) => setConnectors(Number(e.target.value))}
              className="mt-2 h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
            />
            <p className="mt-1 font-mono text-[10px] text-[#8a8578]">
              first {gbp(FIRST_CONNECTOR)} · each further {gbp(NEXT_CONNECTOR)}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="roi-rate" className="text-sm font-semibold text-[#1a1b1f]">Loaded admin rate (£/hr)</label>
              <span className="font-display text-2xl font-black tabular-nums text-[#1a1b1f]">£{rate}</span>
            </div>
            <input
              id="roi-rate"
              type="range"
              min={14}
              max={28}
              step={1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-2 h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#e0dbcd] accent-[#0e6b3f]"
            />
            <p className="mt-1 font-mono text-[10px] text-[#8a8578]">
              ~£28k admin fully loaded ≈ £19/hr — your figure
            </p>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-xl border border-[#0e6b3f]/25 bg-[#f4f8f5] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Removed cost, a year</p>
          <p className="font-display text-5xl font-black leading-none text-[#0e6b3f]">{gbp(m.removedYr)}</p>
          <p className="mt-1 text-sm text-[#5f6068]">
            of hand re-keying taken off the payroll — you keep{' '}
            <strong className="text-[#0b5531]">{Math.round(m.retained * 100)}%</strong> of it every year the engine
            runs.
          </p>

          {/* THE ANSWER — net saving and payback, made dominant */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#0e6b3f]/30 bg-white p-3.5 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#0e6b3f]">Net saving, year 1</dt>
              <dd className="font-display text-3xl font-black leading-none tabular-nums text-[#0e6b3f] sm:text-4xl">
                {gbp(m.netYr1)}
              </dd>
            </div>
            <div className="rounded-xl border border-[#0e6b3f]/30 bg-white p-3.5 shadow-sm">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#0e6b3f]">Pays for itself in</dt>
              <dd className="font-display text-3xl font-black leading-none tabular-nums text-[#0e6b3f] sm:text-4xl">
                {!Number.isFinite(m.paybackMonths) ? '—' : m.paybackMonths < 1 ? '<1' : m.paybackMonths.toFixed(1)}
                {Number.isFinite(m.paybackMonths) && <span className="text-lg font-bold"> mo</span>}
              </dd>
            </div>
          </div>

          {/* the cost side — subordinate, so it doesn't stall the read */}
          <p className="mt-3 border-t border-[#0e6b3f]/15 pt-3 text-xs text-[#8a8578]">
            Year-1 outlay <strong className="font-semibold text-[#5f6068]">{gbp(m.year1)}</strong> ({gbp(m.build)} build
            + {gbp(m.subYr)} run) · ongoing <strong className="font-semibold text-[#5f6068]">{gbp(m.subYr)}/yr</strong>{' '}
            at {gbp(m.monthly)}/mo, {m.band}.
          </p>
        </div>
      </div>

      {/* Year 1–5 cumulative net — the curve steepens once the build is paid */}
      <div className="mt-6 border-t border-[#e6e1d6] pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Cumulative net saving, after fees</p>
          <p className="text-sm text-[#5f6068]">
            Over 5 years: <strong className="font-display text-lg text-[#0e6b3f]">{gbp(m.fiveYearNet)}</strong>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {m.years.map((y) => (
            <div key={y.year} className="rounded-lg border border-[#e6e1d6] bg-[#faf9f5] p-2.5 text-center">
              <p className="font-mono text-[10px] text-[#8a8578]">Year {y.year}</p>
              <p className="font-display text-sm font-black leading-tight tabular-nums text-[#0e6b3f] sm:text-base">
                {gbp(y.net)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#8a8578]">
          Year 1 carries the one-off build; years 2–5 are run only — so the line steepens.
        </p>
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
        Basis: ~{MIN_PER_JOB} min of handling removed per job (both ends), at your loaded rate. Build is one POC
        ({gbp(POC)}) + first connector ({gbp(FIRST_CONNECTOR)}) + {gbp(NEXT_CONNECTOR)} per further connector; run is
        the volume band. No-API / browser-login pairings carry a premium. Indicative — every figure is yours to change.
      </p>
    </div>
  );
}
