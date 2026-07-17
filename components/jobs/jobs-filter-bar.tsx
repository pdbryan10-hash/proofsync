'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'READY', label: 'Ready' },
  { key: 'SYNCED', label: 'Synced' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'EXCEPTION', label: 'Exception' },
  { key: 'FAILED', label: 'Failed' },
];

export function JobsFilterBar({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const activeStatus = params.get('status') ?? 'ALL';
  const [search, setSearch] = useState(params.get('search') ?? '');

  // Debounced push of the search term into the URL.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set('search', search);
      else next.delete('search');
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setStatus(status: string) {
    const next = new URLSearchParams(params.toString());
    if (status === 'ALL') next.delete('status');
    else next.set('status', status);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function setDate(key: 'from' | 'to', value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === 'ALL' ? total : counts[f.key] ?? 0;
            const active = activeStatus === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-navy-800 bg-navy-800 text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
                <span className={cn('rounded px-1.5 text-xs', active ? 'bg-white/20' : 'bg-muted')}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, site, Joblogic ID…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">Completed</span>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setDate('from', e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-navy-800 focus:outline-none"
          aria-label="Completed from"
        />
        <span>to</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setDate('to', e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-navy-800 focus:outline-none"
          aria-label="Completed to"
        />
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              next.delete('from');
              next.delete('to');
              startTransition(() => router.replace(`${pathname}?${next.toString()}`));
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            clear dates
          </button>
        )}
      </div>
    </div>
  );
}
