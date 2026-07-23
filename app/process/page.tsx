import type { Metadata } from 'next';
import Link from 'next/link';
import { Bricolage_Grotesque } from 'next/font/google';
import { Check, Lock, ShieldCheck, FileSignature, Database, DoorOpen, ArrowRight } from 'lucide-react';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';
import { ProofWorksEndorsement } from '@/components/brand/proofworks-badge';
import { CyberEssentialsBadge } from '@/components/brand/cyber-essentials-badge';
import { ProcessRoi } from '@/components/marketing/process-roi';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProofSync — Delivery & Engagement',
  description: 'How ProofSync is delivered, staged, with the commercial terms. Shared on request.',
  // OBSCURE: not for search, not for crawlers. Shared by direct link only.
  robots: { index: false, follow: false, nocache: true },
};

const STAGES = [
  {
    n: '01',
    name: 'Proof of Concept',
    price: '£2,500',
    when: '~1–2 weeks',
    lead: 'Prove it on your own data before you commit to anything.',
    items: [
      'One client system + your field system, one job type, your real data.',
      'The full loop, run end to end — including a live sign-in where there is no API.',
      'Your exception model mapped to your actual jobs.',
      'A clear go / no-go. Nothing further owed if it’s no.',
    ],
  },
  {
    n: '02',
    name: 'First connector — live pairing',
    price: '£6,000',
    when: '~2–4 weeks',
    lead: 'Your first client system, in production, both directions.',
    items: [
      'Production connector: client CAFM ⇄ your field system, in and out.',
      'Field mapping, deterministic idempotent intake, exception routing.',
      'Read-back verification and a full audit trail on every write.',
      'Go-live, monitored.',
    ],
    note: 'A premium applies only to no-API / browser-login pairings — where there is genuinely no substitute for how it’s done.',
  },
  {
    n: '03',
    name: 'Additional connectors',
    price: '£2,500–3,000 each',
    when: 'rolling',
    lead: 'Every further client system, on the engine that’s already proven.',
    items: [
      'Each new client system paired, both directions.',
      'Priced to make the whole estate viable — not to throttle it.',
      'The fan-out is the point: connect the tenth as readily as the first.',
    ],
    note: 'No-API / browser-login pairings carry the premium.',
  },
  {
    n: '04',
    name: 'Run — the engine, kept alive',
    price: '£1,250 / £2,500 / £4,500 per month',
    when: 'ongoing, by volume',
    lead: 'Not maintenance. The layer that keeps your client relationships in step.',
    items: [
      'Running the sync, both ways, across every live connector.',
      'Support, monitoring, and keeping connectors alive when your clients change their systems.',
      'SLAs and the audit trail retained.',
    ],
    note: 'Banded by monthly completed-job volume — Starter / Growth / Scale.',
  },
];

const BANDS = [
  ['Starter', 'up to 1,000 jobs / month', '£1,250 / mo'],
  ['Growth', '1,000–4,000 jobs / month', '£2,500 / mo'],
  ['Scale', '4,000+ jobs / month', '£4,500 / mo'],
];

const LEGAL = [
  {
    icon: FileSignature,
    title: 'Mutual NDA first',
    body: 'A mutual non-disclosure agreement is in place before any system, credential or client data is shared — in either direction. Nothing is discussed with a named client of yours without it.',
  },
  {
    icon: Database,
    title: 'Data handling',
    body: 'We process only the job and completion data needed to move work between your systems, under a written data-processing agreement. UK-hosted, least-privilege, encrypted in transit and at rest.',
  },
  {
    icon: Lock,
    title: 'Access — attended by default',
    body: 'Where a client system has no API, a person signs in with their own MFA and presses go; ProofSync never bypasses MFA and never stores client credentials beyond the working session. Unattended access is only ever enabled with the client’s explicit authorisation.',
  },
  {
    icon: ShieldCheck,
    title: 'Security & audit',
    body: 'Cyber Essentials certified (ProofWorks Ltd). Every write is logged and verifiable on both sides — you can prove what moved, when, and by which route.',
  },
  {
    icon: DoorOpen,
    title: 'Ownership & exit',
    body: 'Your data is yours. Connectors remain ProofWorks IP, licensed to you for as long as you run them. Full export on request, no lock-in beyond the connectors you choose to keep live.',
  },
];

export default function ProcessPage() {
  return (
    <div className={`${display.variable} min-h-screen bg-[#f7f5ef] text-[#1a1b1f]`}>
      {/* Header */}
      <header className="border-b border-[#e6e1d6] bg-[#f7f5ef]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <ProofSyncLogo size="lg" />
            <ProofWorksEndorsement className="ml-0.5" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8a8578]/30 bg-white px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#8a8578]">
            <Lock className="size-3" />
            Private · shared on request
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
        {/* Intro */}
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
          Delivery &amp; engagement
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          How ProofSync goes in — and what it costs.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#4b4c54]">
          ProofSync is infrastructure that sits between your systems and your clients&apos;. It goes in staged, so you
          prove it on your own data before you commit — and the money follows the value, not the other way round.
        </p>
        <Link
          href="/hosting"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0e6b3f] transition-colors hover:text-[#0b5531]"
        >
          Where it runs — hosting &amp; data residency
          <ArrowRight className="size-4" />
        </Link>

        {/* Stages */}
        <section className="mt-12 space-y-4">
          {STAGES.map((s) => (
            <div key={s.n} className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-sm font-bold text-[#0e6b3f]">{s.n}</span>
                  <div>
                    <h2 className="text-xl font-bold">{s.name}</h2>
                    <p className="mt-1 max-w-md text-sm text-[#5f6068]">{s.lead}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-black text-[#0e6b3f]">{s.price}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">{s.when}</p>
                </div>
              </div>
              <ul className="mt-4 grid gap-2 border-t border-[#f0eee6] pt-4 sm:grid-cols-2">
                {s.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-[#33343a]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#0e6b3f]" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              {s.note && (
                <p className="mt-3 rounded-lg border border-[#e6e1d6] bg-[#faf9f5] px-3 py-2 text-xs text-[#6f6f78]">
                  {s.note}
                </p>
              )}
            </div>
          ))}
        </section>

        {/* Subscription bands */}
        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold">Run — monthly bands</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e6e1d6] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e6e1d6] bg-[#faf9f5] font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Band</th>
                  <th className="px-5 py-3 font-semibold">Volume</th>
                  <th className="px-5 py-3 text-right font-semibold">Per month</th>
                </tr>
              </thead>
              <tbody>
                {BANDS.map(([band, vol, price]) => (
                  <tr key={band} className="border-b border-[#f0eee6] last:border-0">
                    <td className="px-5 py-3 font-semibold text-[#1a1b1f]">{band}</td>
                    <td className="px-5 py-3 text-[#5f6068]">{vol}</td>
                    <td className="px-5 py-3 text-right font-display text-lg font-bold text-[#0e6b3f]">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-[#5f6068]">
            Running, support, monitoring, and keeping connectors alive when client systems change. At £2,500/month
            against six figures of removed cost, you keep the large majority of the benefit — the point of a band, not
            a per-seat meter.
          </p>
        </section>

        {/* ROI calculator */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Work it out on your numbers</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#5f6068]">
            The fee against the cost it removes — staged build, banded run, payback in months.
          </p>
          <div className="mt-5">
            <ProcessRoi />
          </div>
        </section>

        {/* Commercial & legal */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Commercial &amp; legal footing</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {LEGAL.map((l) => (
              <div key={l.title} className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <l.icon className="size-5 text-[#0e6b3f]" />
                  <h3 className="font-semibold">{l.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5f6068]">{l.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <ProofWorksEndorsement />
            <CyberEssentialsBadge />
          </div>
          <p className="font-mono text-[11px] text-[#767680]">
            © 2026 ProofWorks Ltd · Private — do not circulate without permission.
          </p>
        </div>
      </footer>
    </div>
  );
}
