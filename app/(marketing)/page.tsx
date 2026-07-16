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
  { n: 1, label: 'Completed once', note: 'Engineer finishes the job in your system. That is the last time anyone types it.' },
  { n: 2, label: 'Matched', note: "Found in your client's system by its unique job reference. No reference, no update — never a guess." },
  { n: 3, label: 'Validated', note: 'Fields checked and mapped to your client’s format before anything is written.' },
  { n: 4, label: 'Client system updated', note: 'Notes, times, costs and status written into the original job.' },
  { n: 5, label: 'Certificates transferred', note: 'Compliance documents attached to the right job, not emailed and forgotten.' },
  { n: 6, label: 'Verified', note: 'The record is read back and compared. If it did not land, you are told.', emphasis: true },
];

export default function SalesPage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(21,128,61,0.18),transparent)]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-20 lg:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">
            For FM contractors
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Your engineer completes the job once.
            <br />
            <span className="text-white/55">Your admin types it into the client&apos;s system all over again.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
            ProofSync moves completed job data — notes, attendance, time on site, costs and certificates —
            out of Joblogic, Simpro or BigChange and into Concerto, Elogbooks, MRI or Planon. Automatically,
            verified, and audited. Your people only see the jobs that genuinely need a human.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-success px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-success-text"
            >
              See it work
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-base font-medium text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
            >
              How it works
            </Link>
            <span className="mt-1 font-mono text-xs text-white/35 sm:ml-2 sm:mt-0">
              Live demonstration · no sign-up
            </span>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM, NAMED AS A ROLE ─────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">The job nobody advertises for</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Somewhere in your office, someone is a human bridge.
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-white/70">
                <p>
                  They open your system. They read the engineer&apos;s notes. They work out the time on site.
                  They download the certificate. They log into your client&apos;s portal. They find the original
                  job. They type it all in again. They upload the certificate. They close the job.
                </p>
                <p>
                  Then they do it for the next one. And the next one. All day.
                </p>
                <p className="font-semibold text-white">
                  That isn&apos;t admin. That&apos;s a job a machine should be doing — and it&apos;s costing you a
                  salary to do it badly, slowly, and inconsistently.
                </p>
              </div>
            </div>

            {/* The double-entry visual */}
            <div className="rounded-xl border border-white/10 bg-navy-900/60 p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/35">Today</p>
              <div className="mt-4 space-y-3">
                <EntryRow label="Engineer completes job" system="Your system" tone="ok" />
                <div className="flex items-center gap-3 pl-1">
                  <div className="h-8 w-px bg-white/15" />
                  <span className="font-mono text-[11px] text-white/40">↓ a person, re-typing</span>
                </div>
                <EntryRow label="Same data, typed again" system="Client's system" tone="bad" />
              </div>
              <p className="mt-6 border-t border-white/10 pt-4 text-sm text-white/50">
                Two systems. One set of facts. Entered twice, by hand, forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY NOBODY HAS FIXED IT ──────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Why it still happens</p>
              <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Your software won&apos;t talk to their software. Neither vendor is going to fix that.
              </h2>
            </div>
            <div className="space-y-5 text-lg leading-relaxed text-white/70">
              <p>
                Your job-management system is built to run <em className="not-italic text-white">your</em> business.
                Your client&apos;s CAFM is built to run <em className="not-italic text-white">theirs</em>. They are
                sold by competitors, to different buyers, with no reason to integrate with each other.
              </p>
              <p>
                So the gap between them gets filled with the cheapest available middleware: a person with two
                screens and a keyboard.
              </p>
              <p className="font-semibold text-white">
                ProofSync is the bridge neither vendor will ever build — because we sit on your side of it,
                and we work with whatever your client happens to run.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS: 6 STAGES ───────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">The sync</p>
          <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Complete once. Everything after that is ours.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-white/60">
            Six stages, every job, every time — and the last one is the one that matters.
          </p>

          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <li
                key={s.n}
                className={`rounded-xl border p-5 ${
                  s.emphasis ? 'border-success/40 bg-success/[0.07]' : 'border-white/10 bg-navy-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-7 items-center justify-center rounded-md font-mono text-xs font-bold ${
                      s.emphasis ? 'bg-success text-white' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {s.emphasis ? <Check className="size-4" /> : s.n}
                  </span>
                  <h3 className={`font-semibold ${s.emphasis ? 'text-success' : 'text-white'}`}>{s.label}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{s.note}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex items-start gap-4 rounded-xl border border-white/10 bg-navy-900/60 p-6">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-success" />
            <div>
              <p className="font-semibold text-white">Verified is not a figure of speech.</p>
              <p className="mt-2 text-white/60">
                After every write, ProofSync reads the record back out of your client&apos;s system and compares
                it against what it sent. If a single field didn&apos;t land, the job doesn&apos;t get marked done —
                it gets raised. Most automation fires and hopes. That&apos;s the difference between a tool and a
                system you can put your name to.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXCEPTIONS ───────────────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Where the human goes</p>
              <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                It doesn&apos;t replace your admin. It hands them only the jobs that actually need them.
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-white/70">
                <p>
                  Most jobs sync cleanly and nobody touches them. Some won&apos;t: a missing client reference,
                  a job that doesn&apos;t exist on their side, a certificate the client&apos;s system rejected.
                </p>
                <p>
                  Those don&apos;t vanish and they don&apos;t fail silently. They land in one queue — every client
                  system, one place — with the reason in plain English and an audit trail behind them. Your
                  admin fixes the reference, hits retry, and moves on.
                </p>
                <p className="font-semibold text-white">
                  You don&apos;t lose a person. You get their week back for work that needs a brain.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-navy-800/70 p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/35">Exception queue</p>
              <div className="mt-4 space-y-3">
                <ExceptionRow icon={TriangleAlert} title="Missing client reference" action="Add reference → retry" />
                <ExceptionRow icon={TriangleAlert} title="Job not found in client system" action="Confirm reference" />
                <ExceptionRow icon={FileCheck2} title="Certificate upload rejected" action="Retry transfer" />
              </div>
              <p className="mt-6 border-t border-white/10 pt-4 text-sm text-white/50">
                Every sync ends in a definite state. Nothing is ever quietly dropped.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI: HEADCOUNT, NOT MINUTES ──────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">What it gives back</p>
          <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Measured in people, not seconds.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-white/60">
            Minutes saved is a number nobody feels. Here it is in the only unit that matters to a budget.
          </p>

          <div className="mt-10 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-navy-900/60">
                <tr className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 font-medium">Completed jobs / month</th>
                  <th className="px-5 py-3 font-medium">Re-keying time</th>
                  <th className="px-5 py-3 font-medium">Equivalent</th>
                </tr>
              </thead>
              <tbody>
                {ROI_ROWS.map((r) => (
                  <tr key={r.jobs} className="border-t border-white/10">
                    <td className="px-5 py-4 font-mono text-lg text-white">{r.jobs.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-lg text-white/70">{Math.round(r.hours)} hrs</td>
                    <td className="px-5 py-4 text-lg font-semibold text-success">
                      {r.fte.toFixed(1)} full-time admin{r.fte >= 2 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-navy-900/50 p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/35">Show your working</p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Basis: <span className="font-mono text-white/80">{MINUTES_PER_JOB} minutes</span> of duplicated
              administration per completed job, and{' '}
              <span className="font-mono text-white/80">{FTE_HOURS_PER_MONTH} hours</span> per full-time month
              (37.5-hour week). This is an <strong className="text-white/80">estimate, not an audited saving</strong> —
              it is our working assumption and you should challenge it with your own numbers. Tell us your real
              job volume and your admin&apos;s honest per-job time and we will recalculate it in front of you.
              We would rather have a defensible number than a flattering one.
            </p>
          </div>
        </div>
      </section>

      {/* ── ANY CLIENT SYSTEM — API OR NOT ───────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">The awkward client</p>
          <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            It works with your client&apos;s system. Even the one with no API.
          </h2>
          <p className="mt-5 max-w-3xl text-lg text-white/60">
            Every contractor has that one account: a client on a system so old or so closed that
            &ldquo;integration&rdquo; is a non-starter. That account is usually the one drowning your admin team.
            It&apos;s also the one everybody else says no to.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <RouteCard
              icon={Plug}
              title="Modern API"
              body="Where your client's system has a proper interface, we use it. Fastest, cleanest, invisible."
            />
            <RouteCard
              icon={Server}
              title="File or portal import"
              body="Where it accepts scheduled imports or portal uploads, we drive those — supported routes, no surprises."
            />
            <RouteCard
              icon={MonitorSmartphone}
              title="No interface at all"
              body="Where there's nothing to connect to, ProofSync securely operates the system the way a person would — with your client's written authorisation and their own service account."
              accent
            />
          </div>

          <p className="mt-8 max-w-3xl text-lg font-semibold text-white">
            The point isn&apos;t the technique. The point is you never have to tell a client &ldquo;we can&apos;t
            automate yours.&rdquo;
          </p>
          <p className="mt-3 max-w-3xl text-sm text-white/45">
            Access to a client&apos;s system is only ever set up with that client&apos;s explicit written approval
            and their own named service account. We don&apos;t go near a system we haven&apos;t been invited into.
          </p>
        </div>
      </section>

      {/* ── TRUST / GOVERNANCE ───────────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">Before your IT team asks</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TrustItem
              icon={ScrollText}
              title="Every sync is evidenced"
              body="What was read, what changed, what was excluded, what the client's system returned, and who intervened — timestamped."
            />
            <TrustItem
              icon={Lock}
              title="Credentials handled properly"
              body="Secrets live in a managed store, never in the database and never in a browser. Access is scoped and revocable."
            />
            <TrustItem
              icon={ShieldCheck}
              title="Client-authorised only"
              body="We connect to a client system on their written say-so, using an account they issue and can switch off."
            />
            <TrustItem
              icon={Server}
              title="Runs where you need it"
              body="Hosted by us, or deployed inside your own environment if your contracts require it."
            />
          </div>
        </div>
      </section>

      {/* ── CLOSE ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-28">
          <div className="rounded-2xl border border-success/25 bg-[radial-gradient(70%_140%_at_50%_0%,rgba(21,128,61,0.16),transparent)] p-8 text-center lg:p-14">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-success">Prove it first</p>
            <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Show us one client system you&apos;re re-keying into.
              <br />
              <span className="text-white/60">We&apos;ll prove the sync on your real data before you commit to anything.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              No procurement exercise, no rip-and-replace. One client, one job type, your actual data — and you
              decide from there.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="mailto:hello@proofsync.co.uk?subject=ProofSync%20%E2%80%94%20prove%20it%20on%20our%20data"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-success px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-success-text"
              >
                Start the conversation
                <ArrowRight className="size-4" />
              </a>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-md px-7 py-3.5 text-base font-medium text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
              >
                See the live demonstration
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ── local presentation components ──────────────────────────────────────── */

function EntryRow({ label, system, tone }: { label: string; system: string; tone: 'ok' | 'bad' }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        tone === 'ok' ? 'border-success/25 bg-success/[0.07]' : 'border-danger/30 bg-danger/[0.08]'
      }`}
    >
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="font-mono text-[11px] uppercase tracking-wide text-white/45">{system}</span>
    </div>
  );
}

function ExceptionRow({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof TriangleAlert;
  title: string;
  action: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-navy-900/50 px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm text-white">
        <Icon className="size-4 shrink-0 text-warning" />
        {title}
      </span>
      <span className="hidden font-mono text-[11px] text-white/40 sm:block">{action}</span>
    </div>
  );
}

function RouteCard({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof Plug;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        accent ? 'border-success/35 bg-success/[0.07]' : 'border-white/10 bg-navy-800/60'
      }`}
    >
      <Icon className={`size-5 ${accent ? 'text-success' : 'text-white/50'}`} />
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div>
      <Icon className="size-5 text-success" />
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}
