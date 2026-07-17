import Link from 'next/link';
import { ArrowRight, Check, X, Minus, Play } from 'lucide-react';

export const metadata = {
  title: 'ProofSync — how it works',
  description:
    'The sync engine, field mapping, exception model, integration routes, security model and deployment options behind ProofSync.',
};

const EXCEPTION_TYPES = [
  ['Missing client reference', 'No reference stored against the job. We refuse to guess.', 'Human'],
  ['Target job not found', 'The reference exists but matches nothing in the client system.', 'Human'],
  ['Duplicate match', 'More than one job matched. Ambiguity is never resolved automatically.', 'Human'],
  ['Required field missing', 'The client system requires a value the source never captured.', 'Human'],
  ['Document upload failed', 'Core data landed; a file did not. Job marked partial.', 'Retry'],
  ['Rate limited / unavailable', 'Client system pushed back or was down.', 'Auto-retry'],
  ['Authentication failed', 'Credentials or permissions changed on the client side.', 'Human'],
];

const LADDER = [
  { rung: '1', route: 'Documented API', pref: 'Preferred', body: 'Direct, fast, resilient. Where the client system exposes a usable interface, this is always the route.' },
  { rung: '2', route: 'Scheduled file import (SFTP/CSV/XML)', pref: 'Good', body: 'Many CAFM platforms accept batch job-update imports. Supported, contractual, robust — and more common than people assume.' },
  { rung: '3', route: 'Contractor portal upload', pref: 'Workable', body: 'A supported human path, driven reliably. Slower, but sanctioned.' },
  { rung: '4', route: 'Internal endpoints', pref: 'Case-by-case', body: "The interfaces the client system's own web app uses. More stable than screen automation. Requires permission." },
  { rung: '5', route: 'Direct automation', pref: 'Last resort', body: 'Only where nothing else exists AND the client authorises it in writing on an account they issue and control. Runs on a dedicated worker, scoped to the job-update task, and still verified by reading the record back. If their terms or security model don’t allow it, this rung is simply closed — and we say so.' },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-16 lg:py-24">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0e6b3f]">Technical overview</p>
      <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[#1a1b1f] sm:text-5xl">
        How ProofSync works
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-[#4b4c54]">
        ProofSync takes a completed job in a contractor&apos;s job-management system and applies it to the
        matching job in the client&apos;s CAFM — then proves it landed. This page is the detail behind that
        sentence, for the person who has to sign it off.
      </p>

      <Section title="The sync engine">
        <p>
          Every sync is an explicit, ordered pipeline. Each stage writes an audit event before the next begins,
          so a run is always reconstructable after the fact — including the ones that failed.
        </p>
        <ol className="mt-6 space-y-3">
          {[
            ['Validate', 'Is the job actually complete? Is there a client job reference, and is it well-formed?'],
            ['Match', 'Look the job up in the client system by its unique reference. Zero matches or several matches both stop the run.'],
            ['Transform', 'Apply the field mapping and the client’s policy rules to build the target payload.'],
            ['Update', 'Write only the permitted, actually-changed fields.'],
            ['Upload', 'Transfer permitted document categories and attach them to the job.'],
            ['Verify', 'Re-read the record from the client system and compare it against what was sent.'],
          ].map(([k, v], i) => (
            <li key={k} className="flex gap-4 rounded-lg border border-[#e6e1d6] bg-white p-4">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-[#efece2] font-mono text-xs text-[#8a8578]">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-[#1a1b1f]">{k}</p>
                <p className="mt-1 text-sm text-[#5f6068]">{v}</p>
              </div>
            </li>
          ))}
        </ol>
        <Callout>
          <strong className="text-[#1a1b1f]">The matching rule is absolute.</strong> A unique, valid client job
          reference is mandatory. No reference, no target, or an ambiguous match each raise a distinct exception.
          ProofSync will never fuzzy-match its way into updating the wrong job on your client&apos;s system —
          that is the one failure mode that would cost you the account.
        </Callout>
      </Section>

      <Section title="Field mapping">
        <p>
          Every client wants their data in a different shape. Mapping is explicit and inspectable — not a
          black box, and not a no-code maze nobody can audit.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border border-[#e6e1d6]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f5ef] font-mono text-[11px] uppercase tracking-widest text-[#8a8578]">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Transform</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="bg-white font-mono text-[#4b4c54]">
              {[
                ['timeOnSite = 127', 'minutes → hours', '2h 7m'],
                ['totalCost = 160.5', 'currency', '£160.50'],
                ['followOn = false', 'boolean → text', 'No'],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-t border-[#e6e1d6]">
                  <td className="px-4 py-3">{a}</td>
                  <td className="px-4 py-3 text-[#8a8578]">{b}</td>
                  <td className="px-4 py-3 font-semibold text-[#0e6b3f]">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5">
          Per-client policy sits on top: whether costs transfer at all, which document categories are permitted,
          and whether ProofSync may move the job status or must leave closure to a human. Operators preview the
          exact result of a mapping before anything is written.
        </p>
      </Section>

      <Section title="The exception model">
        <p>
          Every run ends in a definite state: synced, partially synced, awaiting review, failed, retrying, or
          ignored by rule. Nothing is dropped quietly. The distinction that matters is whether a machine can fix
          it or a human must.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border border-[#e6e1d6]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f5ef] font-mono text-[11px] uppercase tracking-widest text-[#8a8578]">
              <tr>
                <th className="px-4 py-3 font-medium">Exception</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
                <th className="px-4 py-3 font-medium">Resolver</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {EXCEPTION_TYPES.map(([name, meaning, who]) => (
                <tr key={name} className="border-t border-[#e6e1d6]">
                  <td className="px-4 py-3 font-medium text-[#1a1b1f]">{name}</td>
                  <td className="px-4 py-3 text-[#5f6068]">{meaning}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[11px] uppercase ${who === 'Human' ? 'text-[#b4652a]' : 'text-[#0e6b3f]'}`}>
                      {who}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5">
          Transient failures (rate limits, timeouts, outages) retry automatically on a capped backoff.
          Structural problems never retry — retrying a missing reference just produces the same failure more
          often. They go to a person, once.
        </p>
      </Section>

      <Section title="Connecting to a client system">
        <p>
          The sync engine has no knowledge of any specific vendor. It speaks a normalised shape; every
          system-specific detail lives in a connector behind a common interface. Adding a client system is a
          connector, not a rewrite — and we take the highest rung on this ladder the client system supports.
        </p>
        <div className="mt-6 space-y-3">
          {LADDER.map((l) => (
            <div key={l.rung} className="flex gap-4 rounded-lg border border-[#e6e1d6] bg-white p-4">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-[#efece2] font-mono text-xs text-[#8a8578]">
                {l.rung}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#1a1b1f]">{l.route}</p>
                  <span className="rounded-full bg-[#efece2] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#8a8578]">
                    {l.pref}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#5f6068]">{l.body}</p>
              </div>
            </div>
          ))}
        </div>
        <Callout>
          <strong className="text-[#1a1b1f]">On the last rung.</strong> It is last deliberately, and it is gated
          on the client — not on us. It runs only where that client has authorised it in writing, on a service
          account they issue, scope and can revoke at any moment; never against a person&apos;s login, and never
          on a system we haven&apos;t been invited into. It is still verified — the record is re-read and compared,
          exactly as the API route is. And where a client&apos;s terms, security model or MFA mean the answer is
          no, the answer is no: we will tell you that rather than engineer around it. A capability you can&apos;t
          defend in front of the client isn&apos;t a capability, it&apos;s a liability.
        </Callout>
      </Section>

      <Section title="Security &amp; governance">
        <ul className="mt-2 space-y-3">
          {[
            ['Audit trail on every sync', 'What triggered it, which fields were read, changed and excluded, what the client system returned, whether it verified, and who intervened.'],
            ['Secrets never in the database', 'Credentials come from a managed secret store, server-side only. Nothing sensitive reaches a browser.'],
            ['Client-authorised access', 'A client system is only connected on that client’s written approval, with an account they control.'],
            ['Least privilege', 'The integration account gets only the permissions the write-back flow requires.'],
            ['Signed, idempotent ingestion', 'Inbound events are signature-verified and de-duplicated, so a replayed event can never double-update a job.'],
            ['Deployment options', 'Hosted by ProofWorks, or deployed inside your own environment where contracts demand it.'],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-[#0e6b3f]" />
              <div>
                <p className="font-semibold text-[#1a1b1f]">{k}</p>
                <p className="mt-0.5 text-sm text-[#5f6068]">{v}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What ProofSync is not">
        <ul className="mt-2 space-y-3">
          {[
            [X, 'Not a replacement for your job-management system', 'Your system stays exactly as it is. ProofSync reads from it; it does not compete with it.'],
            [X, 'Not a replacement for your client’s CAFM', 'We update their system on their terms. We never ask them to change it.'],
            [X, 'Not an AI product', 'Nothing here guesses. The behaviour is deterministic and inspectable, because you cannot audit a guess.'],
            [Minus, 'Not a way to close jobs behind your client’s back', 'Status changes and job closure are policy-gated, and can require human approval every time.'],
          ].map(([Icon, k, v]) => {
            const I = Icon as typeof X;
            return (
              <li key={k as string} className="flex gap-3">
                <I className="mt-1 size-4 shrink-0 text-[#a9a498]" />
                <div>
                  <p className="font-semibold text-[#1a1b1f]">{k as string}</p>
                  <p className="mt-0.5 text-sm text-[#5f6068]">{v as string}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* CTA */}
      <div className="mt-16 rounded-2xl border border-[#0e6b3f]/25 bg-[radial-gradient(70%_140%_at_50%_0%,rgba(14,107,63,0.10),transparent)] bg-white p-8 text-center shadow-sm">
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#1a1b1f]">See it against your own data</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#5f6068]">
          Name one client system you&apos;re re-keying into. We&apos;ll prove the sync before you commit to anything.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0e6b3f] px-6 py-3 font-semibold text-white shadow-lg shadow-[#0e6b3f]/20 transition-colors hover:bg-[#0b5531]"
          >
            <Play className="size-3.5 fill-current" />
            Watch it sync — live
          </Link>
          <a
            href="/#prove-it"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-[#33343a] ring-1 ring-[#dcd6c8] transition-colors hover:bg-[#efece2]"
          >
            Prove it on your data
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-[#e6e1d6] pt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-[#1a1b1f]">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-[#4b4c54]">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border-l-2 border-[#0e6b3f] bg-[#e7f0ea] p-5 text-sm leading-relaxed text-[#4b4c54]">
      {children}
    </div>
  );
}
