import Link from 'next/link';
import { Bricolage_Grotesque } from 'next/font/google';
import { Play } from 'lucide-react';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';
import { ProofWorksEndorsement } from '@/components/brand/proofworks-badge';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

/**
 * Marketing chrome — warm-paper light theme, deliberately editorial, so the pitch
 * reads like the (light) product rather than a different, darker company.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} flex min-h-screen flex-col bg-[#f7f5ef] text-[#1a1b1f]`}>
      <header className="sticky top-0 z-30 border-b border-[#e6e1d6] bg-[#f7f5ef]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <Link href="/" aria-label="ProofSync home">
              <ProofSyncLogo size="lg" />
            </Link>
            <ProofWorksEndorsement className="ml-0.5" />
          </div>
          <nav className="flex items-center gap-1.5 sm:gap-4">
            <Link
              href="/how-it-works"
              className="hidden text-sm font-medium text-[#5f6068] transition-colors hover:text-[#1a1b1f] sm:block"
            >
              How it works
            </Link>
            <Link
              href="/book"
              className="hidden text-sm font-medium text-[#5f6068] transition-colors hover:text-[#1a1b1f] sm:block"
            >
              Book a session
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full bg-[#0e6b3f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0b5531]"
            >
              <Play className="size-3.5 fill-current" />
              Watch it sync — live
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#e6e1d6] bg-[#efece2]">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <ProofSyncLogo />
              <p className="mt-3 text-sm leading-relaxed text-[#5f6068]">
                The completed job, moved into your client&apos;s system — verified, audited, and only the
                exceptions reach a human.
              </p>
              <div className="mt-4">
                <ProofWorksEndorsement />
              </div>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm">
              <Link href="/demo" className="text-[#33343a] hover:text-[#0e6b3f]">Watch it sync — live</Link>
              <Link href="/how-it-works" className="text-[#33343a] hover:text-[#0e6b3f]">How it works</Link>
              <Link href="/book" className="text-[#33343a] hover:text-[#0e6b3f]">Book a session</Link>
              <a href="https://proof-works.co.uk" target="_blank" rel="noreferrer" className="text-[#33343a] hover:text-[#0e6b3f]">
                ProofWorks
              </a>
            </nav>
          </div>

          <div className="mt-9 flex flex-col gap-3 border-t border-[#e6e1d6] pt-6 text-xs text-[#767680] sm:flex-row sm:items-center sm:justify-between">
            <p>
              © 2026 ProofWorks Ltd. ProofSync is a ProofWorks product. Registered in England &amp; Wales.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/privacy" className="hover:text-[#1a1b1f]">Privacy</Link>
              <Link href="/terms" className="hover:text-[#1a1b1f]">Terms</Link>
              <a href="mailto:info@proof-works.co.uk" className="hover:text-[#1a1b1f]">info@proof-works.co.uk</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
