'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, TriangleAlert, PlugZap, SlidersHorizontal, Inbox, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductLockup } from '@/components/brand/proofsync-logo';

const NAV = [
  { href: '/demo', label: 'Live sync demo', icon: Play, exact: true },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/jobs', label: 'Jobs', icon: ListChecks },
  { href: '/exceptions', label: 'Exceptions', icon: TriangleAlert },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox },
  { href: '/integrations', label: 'Integrations', icon: PlugZap },
  { href: '/settings/mappings', label: 'Settings', icon: SlidersHorizontal },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-900/40 bg-navy-800 lg:flex">
      <div className="border-b border-white/10 p-4">
        <ProductLockup subdued />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="size-4" />
              {item.label}
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

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 lg:hidden">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium',
              active ? 'bg-navy-50 text-navy-800' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
