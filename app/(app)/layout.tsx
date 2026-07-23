import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { ModeBadge } from '@/components/layout/demo-badge';
import { DemoTour } from '@/components/demo/demo-tour';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/config';
import { isDemoEnabled } from '@/lib/demo/config';

/** The product shell — control-room chrome for the live application. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoEnabled();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {APP_NAME}
            </p>
            <p className="truncate text-sm font-semibold text-navy-800">
              Job completion sync — contractor system → client CAFM
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/book" className="relative inline-flex">
              {/* Glow so the CTA is prominent on every page, not just the dashboard */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1.5 rounded-xl bg-emerald-400/50 blur-md motion-safe:animate-pulse"
              />
              <Button variant="success" size="lg" className="relative shadow-lg ring-2 ring-emerald-300/60">
                <span className="sm:hidden">Book a call</span>
                <span className="hidden sm:inline">Book a 15-min call</span>
                <ArrowRight />
              </Button>
            </Link>
            <ModeBadge />
          </div>
        </header>
        <MobileNav />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground lg:px-8">
          ProofSync · Powered by ProofWorks · Representative integration adapters — demonstration build
        </footer>
      </div>
      <DemoTour demo={demo} />
    </div>
  );
}
