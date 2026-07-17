import Link from 'next/link';
import Script from 'next/script';
import { ArrowLeft, ArrowUpRight, CalendarClock, Check } from 'lucide-react';
import { ProofWorksMark } from '@/components/brand/proofworks-badge';

export const metadata = {
  title: 'Book a discovery session — ProofSync',
  description:
    'A 30-minute discovery session: bring one client system you re-key into, and we’ll show you exactly how ProofSync would sync it — on your real data.',
};

const AGENDA = [
  'We look at one client system you’re currently re-keying into.',
  'You watch the live sync run end to end — including how it signs in where there’s no API.',
  'We map your exact job type and show where the exceptions would go.',
  'No slides, no procurement exercise, no commitment.',
];

export default function BookPage() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_40%_at_80%_-10%,rgba(14,107,63,0.08),transparent)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        {/* Context column */}
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5f6068] transition-colors hover:text-[#1a1b1f]">
            <ArrowLeft className="size-4" />
            Back to ProofSync
          </Link>

          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#0e6b3f]/25 bg-[#e7f0ea] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
            <CalendarClock className="size-3.5" />
            30 minutes · your data
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[#1a1b1f] sm:text-5xl">
            Book a discovery session
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[#4b4c54]">
            Bring one client system you&apos;re re-keying into. We&apos;ll show you exactly how ProofSync
            would sync it — on your real data, not a slide.
          </p>

          <ul className="mt-7 space-y-3">
            {AGENDA.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[#33343a]">
                <Check className="mt-0.5 size-4 shrink-0 text-[#0e6b3f]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* ProofWorks endorsement — clear, with a route to what they build. */}
          <div className="mt-9 rounded-xl border border-[#e6e1d6] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <ProofWorksMark className="h-4 w-auto text-[#1a1b1f]" />
              <p className="text-sm font-semibold text-[#1a1b1f]">A ProofWorks product</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#5f6068]">
              ProofWorks builds private business automation that pays for itself. ProofSync is one of the
              systems we run.
            </p>
            <a
              href="https://proof-works.co.uk"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0e6b3f] transition-colors hover:text-[#0b5531]"
            >
              See what ProofWorks builds
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>

        {/* Calendly column */}
        <div className="rounded-2xl border border-[#e6e1d6] bg-white p-1.5 shadow-xl">
          <div
            className="calendly-inline-widget"
            data-url="https://calendly.com/bidengine/proofworks-discovery?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=0e6b3f"
            style={{ minWidth: '320px', height: '720px' }}
          />
          <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
        </div>
      </div>
    </section>
  );
}
