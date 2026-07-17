import Link from 'next/link';
import {
  CheckCircle2,
  TriangleAlert,
  Clock,
  ListChecks,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';
import { SyncStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { getTerminalData } from '@/lib/demo/terminal';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ProofSync — your terminal',
};

// Placeholder identity until real auth is wired in.
const ORG_NAME = 'Meridian FM';
const USER_NAME = 'Ops';

export default async function TerminalPage() {
  const { rows, summary } = await getTerminalData();

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-navy-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <ProofSyncLogo />
            <span className="hidden border-l border-border pl-3 text-sm font-semibold text-navy-800 sm:inline">
              {ORG_NAME}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              Signed in as <span className="font-medium text-navy-800">{USER_NAME}</span>
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">
              {USER_NAME.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-800">Your jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every completed job, where it sits in each system, and anything still waiting on you.
            </p>
          </div>
          <span className="rounded-full border border-border bg-white px-3 py-1 font-mono text-[11px] text-muted-foreground">
            auth coming — this is your live data
          </span>
        </div>

        {/* Summary */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={ListChecks} label="Completed jobs" value={summary.total} />
          <Stat icon={CheckCircle2} label="Synced to Concerto" value={summary.synced + summary.partial} tone="success" />
          <Stat icon={TriangleAlert} label="Waiting for you" value={summary.exceptions} tone={summary.exceptions ? 'warning' : 'muted'} />
          <Stat icon={Clock} label="Hours returned" value={`${summary.hoursReturned}`} tone="info" />
        </div>

        {/* Exceptions callout */}
        {summary.exceptions > 0 && (
          <div className="mt-5 rounded-xl border border-warning-soft bg-warning-soft/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning-text">
              <TriangleAlert className="size-4" />
              {summary.exceptions} job{summary.exceptions === 1 ? '' : 's'} need you
            </div>
            <ul className="mt-2 space-y-1.5">
              {rows
                .filter((r) => r.exception)
                .map((r) => (
                  <li key={r.jobNumber} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                    <span className="font-mono text-xs font-medium text-navy-800">{r.jobNumber}</span>
                    <span className="text-muted-foreground">{r.description}</span>
                    <span className="text-warning-text">— {r.exception!.message}</span>
                    {r.jobId && (
                      <Link href={`/jobs/${r.jobId}`} className="inline-flex items-center gap-0.5 font-medium text-info-text hover:underline">
                        Open <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Jobs table */}
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Joblogic</th>
                  <th className="px-4 py-3 font-medium">Concerto</th>
                  <th className="px-4 py-3 font-medium">Fields</th>
                  <th className="px-4 py-3 font-medium">Sync</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.jobNumber} className={r.exception ? 'bg-warning-soft/20' : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-medium text-navy-800">{r.jobNumber}</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">{r.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[160px] truncate text-navy-800">{r.site}</div>
                      <div className="text-xs text-muted-foreground">{r.engineer ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {r.completedAt ? formatDateTime(r.completedAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{r.joblogicStatus}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={r.concertoStatus === 'Completed' ? 'success' : 'neutral'}>{r.concertoStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.fieldsWritten || '—'}</td>
                    <td className="px-4 py-3">
                      {r.exception ? (
                        <Badge tone="warning" dot>Needs you</Badge>
                      ) : (
                        <SyncStatusBadge status={r.syncStatus} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.jobId && (
                        <Link href={`/jobs/${r.jobId}`} className="inline-flex text-muted-foreground hover:text-navy-800">
                          <ChevronRight className="size-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No jobs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          This terminal reads your Joblogic and Concerto records directly, alongside ProofSync&apos;s own
          audit. Sign-in and per-user access come next.
        </p>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'navy',
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  tone?: 'navy' | 'success' | 'warning' | 'info' | 'muted';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success-text'
      : tone === 'warning'
        ? 'text-warning-text'
        : tone === 'info'
          ? 'text-info-text'
          : tone === 'muted'
            ? 'text-muted-foreground'
            : 'text-navy-800';
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
