import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  FileCheck2,
  Lock,
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
const MINUTES_PER_JOB = 15;
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

export default function SalesPage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(21,128,61,0.18),transparent)]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 lg:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">For FM contractors</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Your engineer completes the job once.
            <br />
            <span className="text-white/55">Your admin types it into the client&apos;s system all over again.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            ProofSync moves the completed job — notes, times, costs, certificates — straight into your
            client&apos;s system. Verified. Audited. Only the exceptions reach a human.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="https://proofsync-demo.vercel.app/demo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-success px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-success-text"
            >
              Watch it sync — live
              <ArrowRight className="size-4" />
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-base font-medium text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
            >
              See it work
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-base font-medium text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
            >
              How it works
            </Link>
            <span className="font-mono text-xs text-white/35 sm:ml-2 sm:w-full">Live demonstration · no sign-up · updates every 30 seconds</span>
          </div>

          {/* Process map carries the thesis visually, above the fold on desktop */}
          <div className="mt-14">
            <ProcessMap />
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-white/30">
              The landscape ProofSync is built for — one engine, any pairing. Connector availability varies by
              platform and by your client&apos;s authorisation. Ask us about yours.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM, NAMED AS A ROLE ─────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">The job nobody advertises for</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.25fr] lg:items-center lg:gap-14">
            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Somewhere in your office, someone is a human bridge.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/70">
                For every completed job, one person does this — by hand, on two screens:
              </p>
              <p className="mt-5 text-lg font-semibold leading-relaxed text-white">
                That isn&apos;t admin. That&apos;s a job a machine should do — and it&apos;s costing you a salary
                to do it slowly and inconsistently.
              </p>
            </div>
            <TediumSteps />
          </div>
        </div>
      </section>

      {/* ── WHY NOBODY HAS FIXED IT ──────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Why it still happens</p>
              <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Your software won&apos;t talk to their software. Neither vendor will fix that.
              </h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-white/70 lg:pt-10">
              <p>
                Your system runs <em className="not-italic text-white">your</em> business. Their CAFM runs{' '}
                <em className="not-italic text-white">theirs</em>. Rival vendors, different buyers, no reason to
                integrate.
              </p>
              <p>So the gap gets filled with the cheapest middleware going: a person with two screens.</p>
              <p className="font-semibold text-white">
                ProofSync is the bridge neither vendor will build — because we sit on your side of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS: 6 STAGES ───────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">The sync</p>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Complete once. Everything after that is ours.
          </h2>

          <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <li
                key={s.n}
                className={`rounded-xl border p-4 ${
                  s.emphasis ? 'border-success/40 bg-success/[0.07]' : 'border-white/10 bg-navy-900/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-6 items-center justify-center rounded font-mono text-[11px] font-bold ${
                      s.emphasis ? 'bg-success text-white' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {s.emphasis ? <Check className="size-3.5" /> : s.n}
                  </span>
                  <h3 className={`text-sm font-semibold ${s.emphasis ? 'text-success' : 'text-white'}`}>{s.label}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{s.note}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-start gap-4 rounded-xl border border-white/10 bg-navy-900/60 p-5">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-success" />
            <p className="text-white/65">
              <strong className="text-white">Verified is not a figure of speech.</strong> After every write we read
              the record back and compare it. If one field didn&apos;t land, the job isn&apos;t marked done — it&apos;s
              raised. Most automation fires and hopes.
            </p>
          </div>
        </div>
      </section>

      {/* ── EXCEPTIONS ───────────────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Where the human goes</p>
              <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                It doesn&apos;t replace your admin. It hands them only the jobs that need them.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/70">
                Most jobs sync clean and nobody touches them. The rest don&apos;t vanish and don&apos;t fail
                silently — they land in one queue, across every client system, with the reason in plain English
                and an audit trail behind them.
              </p>
              <p className="mt-4 text-lg font-semibold text-white">
                You don&apos;t lose a person. You get their week back.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-navy-800/70 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Exception queue</p>
              <div className="mt-3 space-y-2">
                <ExceptionRow icon={TriangleAlert} title="Missing client reference" action="Add reference → retry" />
                <ExceptionRow icon={TriangleAlert} title="Job not found in client system" action="Confirm reference" />
                <ExceptionRow icon={FileCheck2} title="Certificate upload rejected" action="Retry transfer" />
              </div>
              <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/45">
                Every sync ends in a definite state. Nothing is quietly dropped.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI: HEADCOUNT, NOT MINUTES ──────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">What it gives back</p>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Measured in people, not seconds.
          </h2>

          <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-navy-900/60">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 font-medium">Completed jobs / month</th>
                  <th className="px-5 py-3 font-medium">Re-keying time</th>
                  <th className="px-5 py-3 font-medium">Equivalent</th>
                </tr>
              </thead>
              <tbody>
                {ROI_ROWS.map((r) => (
                  <tr key={r.jobs} className="border-t border-white/10">
                    <td className="px-5 py-3.5 font-mono text-lg text-white">{r.jobs.toLocaleString()}</td>
                    <td className="px-5 py-3.5 font-mono text-lg text-white/70">{Math.round(r.hours)} hrs</td>
                    <td className="px-5 py-3.5 text-lg font-semibold text-success">
                      {r.fte.toFixed(1)} full-time admin{r.fte >= 2 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-white/45">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">Show your working — </span>
            Basis: <span className="font-mono text-white/70">{MINUTES_PER_JOB} min</span> of duplicated admin per
            completed job; <span className="font-mono text-white/70">{FTE_HOURS_PER_MONTH} hrs</span> per full-time
            month. This is an <strong className="text-white/70">estimate, not an audited saving</strong> — challenge
            it with your own numbers and we&apos;ll recalculate in front of you. We&apos;d rather be defensible than
            flattering.
          </p>
        </div>
      </section>

      {/* ── ANY CLIENT SYSTEM — API OR NOT ───────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">The awkward client</p>
          <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            It works with your client&apos;s system. Even the one with no API.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-white/60">
            Every contractor has that one account on a system too old or too closed to integrate. It&apos;s usually
            the one drowning your admin team — and the one everybody else says no to.
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

          <p className="mt-7 max-w-3xl text-lg font-semibold text-white">
            So the awkward account stops being the one you can&apos;t help.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-white/45">
            We work within what each client permits. If a system can&apos;t be automated within their rules, we
            tell you that plainly rather than sell you a workaround — and we never touch a system we haven&apos;t
            been invited into.
          </p>
        </div>
      </section>

      {/* ── TRUST / GOVERNANCE ───────────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Before your IT team asks</p>
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TrustItem icon={ScrollText} title="Every sync is evidenced" body="Read, changed, excluded, returned, verified, and who intervened — timestamped." />
            <TrustItem icon={Lock} title="Credentials handled properly" body="Managed secret store. Never in the database, never in a browser." />
            <TrustItem icon={ShieldCheck} title="Client-authorised only" body="Connected on their written say-so, with an account they can switch off." />
            <TrustItem icon={Server} title="Runs where you need it" body="Hosted by us, or inside your own environment." />
          </div>
        </div>
      </section>

      {/* ── CLOSE — the capture tool ─────────────────────────────────────── */}
      <section id="prove-it">
        <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:py-20">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">Prove it first</p>
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Tell us one client system you&apos;re re-keying into.
              <br />
              <span className="text-white/60">We&apos;ll prove the sync on your real data before you commit.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/55">
              One client, one job type, your actual data. No procurement exercise, no rip-and-replace.
            </p>
          </div>

          <div className="mt-9">
            <EnquiryForm pageSource="sales" />
          </div>

          <p className="mt-6 text-center text-sm text-white/40">
            Rather just watch it run first?{' '}
            <Link href="/dashboard" className="text-white/70 underline underline-offset-4 hover:text-white">
              See the live demonstration
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-navy-900/50 px-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm text-white">
        <Icon className="size-4 shrink-0 text-warning" />
        {title}
      </span>
      <span className="hidden font-mono text-[10px] text-white/40 sm:block">{action}</span>
    </div>
  );
}

function RouteCard({ icon: Icon, title, body, accent }: { icon: typeof Plug; title: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'border-success/35 bg-success/[0.07]' : 'border-white/10 bg-navy-800/60'}`}>
      <Icon className={`size-5 ${accent ? 'text-success' : 'text-white/50'}`} />
      <h3 className="mt-3 font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div>
      <Icon className="size-5 text-success" />
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}
