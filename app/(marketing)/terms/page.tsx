import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms — ProofSync',
  description: 'The terms on which the ProofSync website and demonstration are provided.',
};

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-14 lg:py-20">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5f6068] hover:text-[#1a1b1f]">
        <ArrowLeft className="size-4" />
        Back to ProofSync
      </Link>

      <h1 className="mt-8 font-display text-4xl font-bold tracking-[-0.02em] text-[#1a1b1f]">Terms</h1>
      <p className="mt-3 text-sm text-[#767680]">
        Plain-English summary for this website. Any engagement is governed by a separate written agreement.
        Last updated 2026.
      </p>

      <div className="mt-8 space-y-7 text-[#33343a]">
        <Section title="The site & demonstration">
          This website and its live demonstration are provided for information, as-is. The demonstration runs
          on synthetic sample data — it is not connected to any real client system.
        </Section>

        <Section title="Figures are estimates">
          Any time or cost figures shown are illustrative estimates on a stated basis, not guarantees or an
          audited saving. We&apos;re happy to recalculate against your own numbers.
        </Section>

        <Section title="No contract is formed here">
          Nothing on this site is an offer or a contract. If we work together, it will be under a separate
          written agreement setting out scope, authorisations, security and pricing.
        </Section>

        <Section title="Provider & governing law">
          The site is operated by <strong className="text-[#1a1b1f]">ProofWorks Ltd</strong>, registered in
          England &amp; Wales. These terms are governed by the law of England &amp; Wales. Questions:{' '}
          <a className="text-[#0e6b3f] underline" href="mailto:info@proof-works.co.uk">info@proof-works.co.uk</a>.
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#1a1b1f]">{title}</h2>
      <p className="mt-2 leading-relaxed text-[#4b4c54]">{children}</p>
    </section>
  );
}
