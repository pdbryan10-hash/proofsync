'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ListChecks,
  TriangleAlert,
  PlugZap,
  SlidersHorizontal,
  Inbox,
  Play,
  SquareTerminal,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductLockup } from '@/components/brand/proofsync-logo';

const NAV = [
  { href: '/demo', label: 'Live sync demo', icon: Play, exact: true },
  { href: '/terminal', label: 'User terminal', icon: SquareTerminal, exact: true },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/jobs', label: 'Jobs', icon: ListChecks },
  { href: '/exceptions', label: 'Exceptions', icon: TriangleAlert },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox },
  { href: '/integrations', label: 'Integrations', icon: PlugZap },
  { href: '/settings/mappings', label: 'Settings', icon: SlidersHorizontal },
];

// Guided demo tour: from each page, which tab to click next and why. Keeps a
// first-time visitor moving through the story instead of landing on the
// dashboard and not knowing the result lives one tab over.
const TOUR: Record<string, { next: string; hint: string }> = {
  '/demo': { next: '/dashboard', hint: 'Sync run — now see the numbers add up on the Dashboard.' },
  '/dashboard': { next: '/jobs', hint: 'Every completed job synced automatically. Open Jobs to see them.' },
  '/jobs': { next: '/exceptions', hint: 'The rest need a human — open Exceptions to see the ones held back.' },
  '/exceptions': { next: '/integrations', hint: 'Last stop: the two systems it bridges — open Integrations.' },
};

function useDemoTour(demo: boolean, pathname: string) {
  const [dismissed, setDismissed] = useState(true); // hidden until storage read (avoids a flash)
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem('ps_demo_tour_done') === '1');
    } catch {
      setDismissed(false);
    }
  }, []);
  const dismiss = () => {
    try {
      localStorage.setItem('ps_demo_tour_done', '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };
  const base = '/' + (pathname.split('/')[1] || '');
  const step = demo && !dismissed ? TOUR[base] : undefined;
  return { step, dismiss };
}

export function Sidebar({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const { step, dismiss } = useDemoTour(demo, pathname);
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-900/40 bg-navy-800 lg:flex">
      <div className="border-b border-white/10 p-4">
        <ProductLockup subdued />
      </div>
      {step && (
        <div className="mx-3 mt-3 rounded-md border border-amber-300/40 bg-amber-400/15 p-3 text-[11.5px] leading-relaxed text-amber-100">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-amber-50">Quick tour</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss tour"
              className="shrink-0 rounded p-0.5 text-amber-200/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 text-amber-100/90">{step.hint}</p>
        </div>
      )}
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isTarget = step?.next === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                isTarget && 'ring-2 ring-amber-300 ring-offset-2 ring-offset-navy-800',
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {isTarget && (
                <span className="ml-auto inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-900">
                  Click <ArrowRight className="size-3" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-md bg-white/5 p-3 text-[11px] leading-relaxed text-white/60">
          <p className="font-semibold text-white/80">Complete once.</p>
          <p>Sync automatically.</p>
          <p>Review only the exceptions.</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const { step } = useDemoTour(demo, pathname);
  return (
    <>
      {step && (
        <div className="flex items-center gap-2 border-b border-amber-300/40 bg-amber-400/15 px-3 py-2 text-[11.5px] font-medium text-amber-900 lg:hidden">
          <ArrowRight className="size-3.5 shrink-0 animate-pulse" />
          {step.hint}
        </div>
      )}
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 lg:hidden">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isTarget = step?.next === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium',
                active ? 'bg-navy-50 text-navy-800' : 'text-muted-foreground',
                isTarget && 'ring-2 ring-amber-400 text-navy-800',
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
