import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy — ProofSync',
  description: 'How ProofWorks Ltd handles the information you share through the ProofSync site.',
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-14 lg:py-20">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5f6068] hover:text-[#1a1b1f]">
        <ArrowLeft className="size-4" />
        Back to ProofSync
      </Link>

      <h1 className="mt-8 font-display text-4xl font-bold tracking-[-0.02em] text-[#1a1b1f]">Privacy</h1>
      <p className="mt-3 text-sm text-[#767680]">
        Plain-English summary. A formal policy is available on request. Last updated 2026.
      </p>

      <div className="mt-8 space-y-7 text-[#33343a]">
        <Section title="Who we are">
          ProofSync is a product of <strong className="text-[#1a1b1f]">ProofWorks Ltd</strong>, registered in
          England &amp; Wales. We are the data controller for information you share here. Contact us any time
          at <a className="text-[#0e6b3f] underline" href="mailto:info@proof-works.co.uk">info@proof-works.co.uk</a>.
        </Section>

        <Section title="What we collect">
          Only what you enter in the enquiry form — your name, work email, and optionally your company, the
          systems you use, your job volume and any message. The live demonstration runs on synthetic sample
          data and does not collect personal information.
        </Section>

        <Section title="Why we hold it">
          Solely to respond to you about ProofSync. We do not add you to a mailing list, send newsletters, or
          sell or share your details with anyone.
        </Section>

        <Section title="Cookies">
          The main site sets no marketing or advertising cookies. The booking page embeds Calendly, which sets
          its own cookies when you interact with it to schedule a session.
        </Section>

        <Section title="Retention & your rights">
          We keep enquiry details only as long as needed for the conversation with you. You can ask us to show
          you what we hold, correct it, or delete it — email{' '}
          <a className="text-[#0e6b3f] underline" href="mailto:info@proof-works.co.uk">info@proof-works.co.uk</a>{' '}
          and we&apos;ll action it.
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
