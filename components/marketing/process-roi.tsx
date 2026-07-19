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
  if (jobs <= 500) return { band: 'Starter', monthly: 1200 };
  if (jobs <= 1500) return { band: 'Growth', monthly: 2500 };
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
    const paybackMonths = removedYr > 0 ? year1 / (removedYr / 12) : 0;
    const retained = removedYr > 0 ? (removedYr - subYr) / removedYr : 0;
    return { removedYr, band, monthly, subYr, build, year1, netYr1, paybackMonths, retained };
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
            <strong className="text-[#0b5531]">{Math.round(m.retained * 100)}%</strong> of it.
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#0e6b3f]/15 pt-4 text-sm">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Year-1 investment</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-[#1a1b1f]">{gbp(m.year1)}</dd>
              <dd className="text-[11px] text-[#8a8578]">{gbp(m.build)} build + {gbp(m.subYr)} run</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Ongoing, a year</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-[#1a1b1f]">{gbp(m.subYr)}</dd>
              <dd className="text-[11px] text-[#8a8578]">{gbp(m.monthly)}/mo · {m.band}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Net, year 1</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-[#0e6b3f]">{gbp(m.netYr1)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Pays for itself in</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-[#0e6b3f]">
                {m.paybackMonths < 1 ? '<1' : m.paybackMonths.toFixed(1)} months
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
        Basis: ~{MIN_PER_JOB} min of handling removed per job (both ends), at your loaded rate. Build is one POC
        ({gbp(POC)}) + first connector ({gbp(FIRST_CONNECTOR)}) + {gbp(NEXT_CONNECTOR)} per further connector; run is
        the volume band. No-API / browser-login pairings carry a premium. Indicative — every figure is yours to change.
      </p>
    </div>
  );
}
