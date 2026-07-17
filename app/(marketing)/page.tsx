import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ShieldCheck,
  FileCheck2,
  Lock,
  Play,
  Server,
  ScrollText,
  TriangleAlert,
  MonitorSmartphone,
  Plug,
} from 'lucide-react';
import { ProcessMap } from '@/components/marketing/process-map';
import { TediumSteps } from '@/components/marketing/tedium-steps';
import { EnquiryForm } from '@/components/marketing/enquiry-form';

export const metadata = {
  title: 'ProofSync — stop typing every completed job twice',
  description:
    "Your engineer completes the job once. ProofSync puts it into your client's system for you — verified, audited, and only the exceptions reach a human.",
};

/** Working assumption for all value figures on this page. Shown inline, always. */
const MINUTES_PER_JOB = 7;
const FTE_HOURS_PER_MONTH = 162.5; // 37.5h week × 52 ÷ 12

const ROI_ROWS = [500, 1000, 2000].map((jobs) => {
  const hours = (jobs * MINUTES_PER_JOB) / 60;
  return { jobs, hours, fte: hours / FTE_HOURS_PER_MONTH };
});

const STAGES = [
  { n: 1, label: 'Completed once', note: 'The last time anyone types it.' },
  { n: 2, label: 'Matched', note: 'Found by unique job reference. No reference, no update — never a guess.' },
  { n: 3, label: 'Validated', note: 'Checked and mapped to your client’s format before anything is written.' },
  { n: 4, label: 'Client system updated', note: 'Notes, times, costs and status, into the original job.' },
  { n: 5, label: 'Certificates transferred', note: 'Attached to the right job. Not emailed and forgotten.' },
  { n: 6, label: 'Verified', note: 'Read back and compared. If it didn’t land, you’re told.', emphasis: true },
];

// Shared type tokens for the light editorial theme.
const EYEBROW = 'font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0e6b3f]';
const EYEBROW_MUTED = 'font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#8a8578]';
const H2 = 'font-display text-3xl font-bold leading-[1.1] text-[#1a1b1f] sm:text-4xl';
const BODY = 'text-lg leading-relaxed text-[#4b4c54]';

export default function SalesPage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_-10%,rgba(14,107,63,0.10),transparent)]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 lg:py-20">
          <p className={EYEBROW}>For FM contractors</p>
          <h1 className="mt-5 max-w-4xl font-display text-[2.6rem] font-bold leading-[1.03] tracking-[-0.02em] text-[#1a1b1f] sm:text-6xl lg:text-[4.2rem]">
            Stop typing every completed job twice.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-[#3a3b42]">
            Your engineer completes the job once. Today your admin types it into the client&apos;s system
            all over again. <span className="text-[#1a1b1f]">ProofSync does that part for you</span> —
            verified, audited, and only the exceptions reach a human.
          </p>

          {/* CTA ladder — one loud primary (self-serve demo), one quiet secondary. */}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/demo"
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#0e6b3f] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#0e6b3f]/20 transition-all hover:bg-[#0b5531] hover:shadow-xl"
            >
              <Play className="size-4 fill-current" />
              Watch it sync — live
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 text-base font-medium text-[#33343a] underline decoration-[#cfc9ba] decoration-1 underline-offset-4 transition-colors hover:text-[#0e6b3f] hover:decoration-[#0e6b3f]"
              >
                <CalendarClock className="size-4" />
                Book a discovery session
              </Link>
            </div>
          </div>
          <p className="mt-3 font-mono text-xs text-[#8a8578]">No sign-up · runs on real data · no slides</p>

          {/* THE MOMENT — one engine, a whole wall of client systems. */}
          <div className="mt-14 rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0e6b3f]/25 bg-[#e7f0ea] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0e6b3f] opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#0e6b3f]" />
                </span>
                One engine · any pairing
              </span>
              <span className="text-sm text-[#5f6068]">
                Your system on the left. The client&apos;s — whichever of these they run — on the right.
              </span>
            </div>
            <ProcessMap />
          </div>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#6f6f78]">
            The landscape ProofSync is built for. Connector availability varies by platform and by your
            client&apos;s authorisation. Ask us about yours.
          </p>
        </div>
      </section>

      {/* ── THE PROBLEM, NAMED AS A ROLE ─────────────────────────────────── */}
      <section className="border-y border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <p className={EYEBROW_MUTED}>The job nobody advertises for</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.25fr] lg:items-center lg:gap-14">
            <div>
              <h2 className={H2}>Somewhere in your office, someone is a human bridge.</h2>
              <p className={`mt-5 ${BODY}`}>For every completed job, one person does this — by hand, on two screens:</p>
              <p className="mt-5 text-lg font-semibold leading-relaxed text-[#1a1b1f]">
                That isn&apos;t admin. That&apos;s a job a machine should do — and it&apos;s costing you a salary
                to do it slowly and inconsistently.
              </p>
            </div>
            <TediumSteps />
          </div>
        </div>
      </section>

      {/* ── WHY NOBODY HAS FIXED IT ──────────────────────────────────────── */}
      <section className="border-b border-[#e6e1d6]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className={EYEBROW_MUTED}>Why it still happens</p>
              <h2 className={`mt-5 ${H2}`}>
                Your software won&apos;t talk to their software. Neither vendor will fix that.
              </h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-[#4b4c54] lg:pt-10">
              <p>
                Your system runs <em className="not-italic font-semibold text-[#1a1b1f]">your</em> business.
                Their CAFM runs <em className="not-italic font-semibold text-[#1a1b1f]">theirs</em>. Rival
                vendors, different buyers, no reason to integrate.
              </p>
              <p>So the gap gets filled with the cheapest middleware going: a person with two screens.</p>
              <p className="font-semibold text-[#1a1b1f]">
                ProofSync is the bridge neither vendor will build — because we sit on your side of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS: 6 STAGES ───────────────────────────────────────── */}
      <section className="border-b border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <p className={EYEBROW}>The sync</p>
          <h2 className={`mt-5 ${H2}`}>Complete once. Everything after that is ours.</h2>

          <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <li
                key={s.n}
                className={`rounded-xl border p-5 ${
                  s.emphasis ? 'border-[#0e6b3f]/30 bg-[#e7f0ea]' : 'border-[#e6e1d6] bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-6 items-center justify-center rounded font-mono text-[11px] font-bold ${
                      s.emphasis ? 'bg-[#0e6b3f] text-white' : 'bg-[#efece2] text-[#8a8578]'
                    }`}
                  >
                    {s.emphasis ? <Check className="size-3.5" /> : s.n}
                  </span>
                  <h3 className={`text-sm font-semibold ${s.emphasis ? 'text-[#0e6b3f]' : 'text-[#1a1b1f]'}`}>
                    {s.label}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5f6068]">{s.note}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-start gap-4 rounded-xl border border-[#e6e1d6] bg-white p-5">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-[#0e6b3f]" />
            <p className="text-[#4b4c54]">
              <strong className="text-[#1a1b1f]">Verified is not a figure of speech.</strong> After every
              write we read the record back and compare it. If one field didn&apos;t land, the job isn&apos;t
              marked done — it&apos;s raised. Most automation fires and hopes.
            </p>
          </div>
        </div>
      </section>

      {/* ── EXCEPTIONS ───────────────────────────────────────────────────── */}
      <section className="border-b border-[#e6e1d6]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <div>
              <p className={EYEBROW_MUTED}>Where the human goes</p>
              <h2 className={`mt-5 ${H2}`}>
                It doesn&apos;t replace your admin. It hands them only the jobs that need them.
              </h2>
              <p className={`mt-5 ${BODY}`}>
                Most jobs sync clean and nobody touches them. The rest don&apos;t vanish and don&apos;t fail
                silently — they land in one queue, across every client system, with the reason in plain
                English and an audit trail behind them.
              </p>
              <p className="mt-4 text-lg font-semibold text-[#1a1b1f]">
                You don&apos;t lose a person. You get their week back.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Exception queue</p>
              <div className="mt-3 space-y-2">
                <ExceptionRow icon={TriangleAlert} title="Missing client reference" action="Add reference → retry" />
                <ExceptionRow icon={TriangleAlert} title="Job not found in client system" action="Confirm reference" />
                <ExceptionRow icon={FileCheck2} title="Certificate upload rejected" action="Retry transfer" />
              </div>
              <p className="mt-4 border-t border-[#e6e1d6] pt-3 text-xs text-[#767680]">
                Every sync ends in a definite state. Nothing is quietly dropped.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI: HEADCOUNT, NOT MINUTES ──────────────────────────────────── */}
      <section className="border-b border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <p className={EYEBROW}>What it gives back</p>
          <h2 className={`mt-5 ${H2}`}>Measured in people, not seconds.</h2>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#e6e1d6] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#f7f5ef]">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">
                  <th className="px-5 py-3 font-medium">Completed jobs / month</th>
                  <th className="px-5 py-3 font-medium">Re-keying time</th>
                  <th className="px-5 py-3 font-medium">Equivalent</th>
                </tr>
              </thead>
              <tbody>
                {ROI_ROWS.map((r) => (
                  <tr key={r.jobs} className="border-t border-[#e6e1d6]">
                    <td className="px-5 py-3.5 font-mono text-lg text-[#1a1b1f]">{r.jobs.toLocaleString()}</td>
                    <td className="px-5 py-3.5 font-mono text-lg text-[#5f6068]">{Math.round(r.hours)} hrs</td>
                    <td className="px-5 py-3.5 text-lg font-semibold text-[#0e6b3f]">
                      {r.fte.toFixed(1)} full-time admin{r.fte >= 2 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[#5f6068]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#6f6f78]">Show your working — </span>
            Basis: <span className="font-mono text-[#33343a]">{MINUTES_PER_JOB} min</span> of duplicated admin
            per completed job; <span className="font-mono text-[#33343a]">{FTE_HOURS_PER_MONTH} hrs</span> per
            full-time month. This is an <strong className="text-[#33343a]">estimate, not an audited saving</strong>{' '}
            — challenge it with your own numbers and we&apos;ll recalculate in front of you. We&apos;d rather be
            defensible than flattering.
          </p>
        </div>
      </section>

      {/* ── ANY CLIENT SYSTEM — API OR NOT ───────────────────────────────── */}
      <section className="border-b border-[#e6e1d6]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
          <p className={EYEBROW_MUTED}>The awkward client</p>
          <h2 className={`mt-5 max-w-3xl ${H2}`}>It works with your client&apos;s system. Even the one with no API.</h2>
          <p className="mt-5 max-w-2xl text-lg text-[#5f6068]">
            Every contractor has that one account on a system too old or too closed to integrate. It&apos;s
            usually the one drowning your admin team — and the one everybody else says no to.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <RouteCard icon={Plug} title="Modern API" body="Where it exists, we use it. Fastest and invisible." />
            <RouteCard icon={Server} title="File or portal import" body="Scheduled imports and portal uploads — supported routes, no surprises." />
            <RouteCard
              icon={MonitorSmartphone}
              title="No interface at all"
              body="Where your client authorises it in writing and issues a service account of their own, we can automate the update directly. Their permission is the starting point, not a footnote."
              accent
            />
          </div>

          <p className="mt-7 max-w-3xl text-lg font-semibold text-[#1a1b1f]">
            So the awkward account stops being the one you can&apos;t help.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-[#767680]">
            We work within what each client permits. If a system can&apos;t be automated within their rules, we
            tell you that plainly rather than sell you a workaround — and we never touch a system we
            haven&apos;t been invited into.
          </p>
        </div>
      </section>

      {/* ── TRUST / GOVERNANCE ───────────────────────────────────────────── */}
      <section className="border-b border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <p className={EYEBROW_MUTED}>Before your IT team asks</p>
          <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <TrustItem icon={ScrollText} title="Every sync is evidenced" body="Read, changed, excluded, returned, verified, and who intervened — timestamped." />
            <TrustItem icon={Lock} title="Credentials handled properly" body="Managed secret store. Never in the database, never in a browser." />
            <TrustItem icon={ShieldCheck} title="Client-authorised only" body="Connected on their written say-so, with an account they can switch off." />
            <TrustItem icon={Server} title="Runs where you need it" body="Hosted by us, or inside your own environment." />
          </div>
        </div>
      </section>

      {/* ── CLOSE — the capture tool ─────────────────────────────────────── */}
      <section id="prove-it" className="bg-[#f7f5ef]">
        <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:py-24">
          <div className="text-center">
            <p className={EYEBROW}>Prove it first</p>
            <h2 className={`mx-auto mt-5 max-w-3xl font-display text-3xl font-bold leading-[1.1] text-[#1a1b1f] sm:text-[2.6rem]`}>
              Tell us one client system you&apos;re re-keying into.
              <span className="block text-[#0b5531]">We&apos;ll prove the sync on your real data.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-[#5f6068]">
              One client, one job type, your actual data. No procurement exercise, no rip-and-replace.
            </p>
          </div>

          <div className="mt-9">
            <EnquiryForm pageSource="sales" />
          </div>

          <p className="mt-6 text-center text-sm text-[#767680]">
            Rather just watch it run first?{' '}
            <Link href="/demo" className="font-medium text-[#0e6b3f] underline underline-offset-4 hover:text-[#0b5531]">
              Watch it sync — live
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

/* ── local presentation components ──────────────────────────────────────── */

function ExceptionRow({ icon: Icon, title, action }: { icon: typeof TriangleAlert; title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e6e1d6] bg-[#f7f5ef] px-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-[#1a1b1f]">
        <Icon className="size-4 shrink-0 text-[#b4652a]" />
        {title}
      </span>
      <span className="hidden font-mono text-[10px] text-[#8a8578] sm:block">{action}</span>
    </div>
  );
}

function RouteCard({ icon: Icon, title, body, accent }: { icon: typeof Plug; title: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'border-[#0e6b3f]/30 bg-[#e7f0ea]' : 'border-[#e6e1d6] bg-white'}`}>
      <Icon className={`size-5 ${accent ? 'text-[#0e6b3f]' : 'text-[#8a8578]'}`} />
      <h3 className="mt-3 font-semibold text-[#1a1b1f]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#5f6068]">{body}</p>
    </div>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div>
      <Icon className="size-5 text-[#0e6b3f]" />
      <h3 className="mt-3 text-sm font-semibold text-[#1a1b1f]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#5f6068]">{body}</p>
    </div>
  );
}
