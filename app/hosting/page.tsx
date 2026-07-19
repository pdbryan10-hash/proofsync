import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import {
  Lock, Cloud, Server, Building2, Globe, Database, Cog, Chrome, KeyRound, Network, ArrowLeftRight, ShieldCheck,
  Check, Minus,
} from 'lucide-react';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';
import { ProofWorksEndorsement } from '@/components/brand/proofworks-badge';
import { CyberEssentialsBadge } from '@/components/brand/cyber-essentials-badge';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProofSync — Hosting & data residency',
  description: 'How ProofSync is deployed: managed, single-tenant in your cloud, or self-hosted. Azure or AWS.',
  robots: { index: false, follow: false, nocache: true },
};

const MODELS = [
  {
    icon: Cloud,
    title: 'Managed by us',
    body: 'We run it; you authorise the connectors.',
    pros: [
      'Live in weeks — nothing for your team to build or run',
      'No infrastructure, patching or on-call on your side',
      'We monitor and keep connectors alive — issues are ours to fix',
      'UK-hosted, DPA and full audit trail included',
    ],
    cons: [
      'Your data sits in our environment (under DPA), not in-house',
      'You depend on our platform and availability',
      'Least direct control over the environment',
    ],
  },
  {
    icon: Building2,
    title: 'Single-tenant, your cloud',
    body: 'Deployed into your own Azure or AWS subscription — operated by us.',
    pros: [
      'Your data never leaves your tenancy — easiest security sign-off',
      'Your network, logging and controls apply throughout',
      'Still fully operated by us — you don’t run it day-to-day',
      'Data residency and compliance simple to evidence',
    ],
    cons: [
      'Slower to stand up — provisioning, access and networking in your subscription',
      'Your cloud costs (compute, database, egress) sit on your bill',
      'You grant us scoped access to operate it',
      'Provisioned per engagement — not an off-the-shelf switch',
    ],
  },
  {
    icon: Server,
    title: 'You self-host',
    body: 'Take the container images and run them yourself.',
    pros: [
      'Total control — your images, your pipeline, your environment',
      'No third-party operational dependency',
      'Fits an organisation with a strong internal platform team',
    ],
    cons: [
      'You own uptime, upgrades, monitoring and incident response',
      'You lose the biggest ongoing value — us keeping connectors alive as clients change systems',
      'Browser pool, scheduler, secrets and networking are all yours to run',
      'Slowest to value, highest internal cost',
    ],
  },
];

const MAP: [string, string, string][] = [
  ['The app — Next.js container', 'ECS / Fargate · App Runner · EKS', 'Container Apps · App Service · AKS'],
  ['Database — MongoDB Atlas', 'Atlas in an AWS UK region, VPC-peered', 'Atlas in an Azure UK region, VNet-peered'],
  ['Sync worker / schedule', 'In-container loop · EventBridge Scheduler', 'In-container loop · Azure Scheduler'],
  ['No-API browser pool', 'Playwright/Chrome on Fargate', 'Playwright/Chrome on Container Apps'],
  ['Secrets (session-only creds)', 'Secrets Manager', 'Key Vault'],
  ['Stable outbound IP (allow-listing)', 'NAT Gateway', 'NAT Gateway · Azure Firewall'],
];

const COMPONENTS = [
  { icon: Cog, name: 'ProofSync app + sync engine', sub: 'web UI, API, the workflow' },
  { icon: Cog, name: 'Sync worker', sub: 'the beat, both directions' },
  { icon: Database, name: 'MongoDB Atlas', sub: 'UK region · peered in' },
  { icon: Chrome, name: 'Browser pool', sub: 'no-API sign-in · optional' },
  { icon: KeyRound, name: 'Secret store', sub: 'Key Vault / Secrets Manager' },
  { icon: Network, name: 'NAT / egress IP', sub: 'stable IP to allow-list' },
];

export default function HostingPage() {
  return (
    <div className={`${display.variable} min-h-screen bg-[#f7f5ef] text-[#1a1b1f]`}>
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
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
          Hosting &amp; data residency
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          Where it runs — your cloud or ours.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#4b4c54]">
          A standard, portable stack: a web app, a database, a sync worker, and — for clients whose systems have no API
          — a browser pool. Nothing is locked to one cloud provider.{' '}
          <strong className="text-[#1a1b1f]">It runs equally in Azure or AWS.</strong>
        </p>

        {/* Three models — with pros and cons spelled out */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Three ways to host it — pros &amp; cons</h2>
          <div className="mt-5 space-y-4">
            {MODELS.map((m) => (
              <div key={m.title} className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <m.icon className="size-5 text-[#0e6b3f]" />
                  <h3 className="text-lg font-bold">{m.title}</h3>
                  <span className="text-sm text-[#5f6068]">— {m.body}</span>
                </div>
                <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0e6b3f]">Pros</p>
                    <ul className="space-y-1.5">
                      {m.pros.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-[#33343a]">
                          <Check className="mt-0.5 size-4 shrink-0 text-[#0e6b3f]" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#9f1239]">Cons</p>
                    <ul className="space-y-1.5">
                      {m.cons.map((c) => (
                        <li key={c} className="flex items-start gap-2 text-sm text-[#5f6068]">
                          <Minus className="mt-0.5 size-4 shrink-0 text-[#9f1239]" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Topology — single-tenant in the client's cloud */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Single-tenant, in your tenancy</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#5f6068]">
            The deployment an IT security team asks for: every component inside your own subscription, one region, your
            data never crossing the boundary. We operate it from outside — we never hold your data.
          </p>

          {/* external systems */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e6e1d6] bg-white p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Your field system</p>
              <p className="mt-1 text-sm font-semibold">Joblogic · Simpro · BigChange…</p>
            </div>
            <div className="rounded-xl border border-[#e6e1d6] bg-white p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">Your clients&apos; systems</p>
              <p className="mt-1 text-sm font-semibold">Concerto · Elogbooks · Planon…</p>
            </div>
          </div>

          {/* the connector both ways */}
          <div className="my-2 flex items-center justify-center gap-2 text-[#0e6b3f]">
            <ArrowLeftRight className="size-4" />
            <span className="font-mono text-[10px] uppercase tracking-widest">
              API where there is one · attended sign-in where there isn’t — both ways
            </span>
          </div>

          {/* the tenancy boundary */}
          <div className="rounded-2xl border-2 border-dashed border-[#0e6b3f]/45 bg-[#f4f8f5] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0e6b3f] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
                <ShieldCheck className="size-3" />
                Your cloud tenancy
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0b5531]">
                <Globe className="size-3.5" />
                Azure UK South · or · AWS eu-west-2 — one region
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {COMPONENTS.map((c) => (
                <div key={c.name} className="rounded-lg border border-[#0e6b3f]/20 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <c.icon className="size-4 shrink-0 text-[#0e6b3f]" />
                    <span className="text-[13px] font-semibold leading-tight">{c.name}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[#8a8578]">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* management plane */}
          <div className="my-2 flex items-center justify-center gap-2 text-[#8a8578]">
            <Lock className="size-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-widest">operate &amp; monitor only — no data leaves</span>
          </div>
          <div className="rounded-xl border border-[#e6e1d6] bg-white p-4 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">ProofWorks</p>
            <p className="mt-1 text-sm font-semibold">Deploy, run, and keep connectors alive as your clients change systems</p>
          </div>
        </section>

        {/* Component mapping */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Azure or AWS — component by component</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e6e1d6] bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-[#e6e1d6] bg-[#faf9f5] font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Piece</th>
                  <th className="px-4 py-3 font-semibold">On AWS</th>
                  <th className="px-4 py-3 font-semibold">On Azure</th>
                </tr>
              </thead>
              <tbody>
                {MAP.map(([piece, aws, azure]) => (
                  <tr key={piece} className="border-b border-[#f0eee6] last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#1a1b1f]">{piece}</td>
                    <td className="px-4 py-3 text-[#5f6068]">{aws}</td>
                    <td className="px-4 py-3 text-[#5f6068]">{azure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* The two decisions + residency */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">The two things to decide</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Chrome className="size-5 text-[#0e6b3f]" />
                <h3 className="font-semibold">The no-API browser pool</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#5f6068]">
                Our hosted pool, or one we stand up inside your environment. The only cloud-specific choice — driven by
                your data-residency stance, not by which cloud you run. Sign-in is attended: a person uses their own
                MFA; we never bypass it or store credentials beyond the session.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e6e1d6] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Globe className="size-5 text-[#0e6b3f]" />
                <h3 className="font-semibold">Region co-location</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#5f6068]">
                App, database and browser pool sit in the <strong className="text-[#1a1b1f]">same UK region</strong> —
                a placement discipline, not a cloud limitation. Keeps latency low and data residency simple.
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-[#e6e1d6] bg-[#faf9f5] px-4 py-3 text-xs leading-relaxed text-[#6f6f78]">
            MongoDB Atlas is itself multi-cloud — you choose whether the cluster physically sits in an Azure or an AWS
            UK region, and peer it into your network. (We steer away from Cosmos DB’s Mongo API — its compatibility
            gaps aren’t worth it when Atlas-on-Azure is a clean like-for-like.)
          </p>
        </section>
      </main>

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
