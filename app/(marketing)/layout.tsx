import Link from 'next/link';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';

/**
 * Marketing chrome. Deliberately minimal and dark-navy so the transition from
 * pitch → live product reads as one system, not two websites.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="ProofSync home">
            <ProofSyncLogo subdued />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5">
            <Link href="/how-it-works" className="hidden text-sm text-white/70 transition-colors hover:text-white sm:block">
              How it works
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-white/10 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              See it work
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white/80">ProofSync</p>
            <p className="mt-1 text-xs">A ProofWorks product · Registered in England</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/how-it-works" className="hover:text-white">How it works</Link>
            <Link href="/dashboard" className="hover:text-white">Live demonstration</Link>
            <a href="mailto:hello@proofsync.co.uk" className="hover:text-white">hello@proofsync.co.uk</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
