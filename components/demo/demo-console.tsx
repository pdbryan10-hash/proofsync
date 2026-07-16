'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileWarning,
  Loader2,
  Lock,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDuration, timeAgo } from '@/lib/utils';
import type { DemoState, LedgerRow, SourceRow, TargetRow } from '@/lib/demo/state';
import { useChangedRows, useDemoState } from './use-demo-state';

/**
 * The live sync console.
 *
 * Left: what the contractor's system holds. Middle: what ProofSync did about it.
 * Right: what the client's system now holds. Three columns because the claim is
 * a three-column claim — data left a system, something happened to it, and it
 * arrived in another system. Showing only the middle would ask the viewer to
 * take the ends on trust.
 */
export function DemoConsole() {
  const { state, error, busy, reset, forceTick } = useDemoState();

  if (error && !state) {
    return (
      <div className="mx-auto max-w-2xl p-10">
        <div className="rounded-lg border border-danger-soft bg-danger-soft p-6 text-danger-text">
          <h2 className="font-semibold">The demo could not start</h2>
          <p className="mt-2 text-sm">{error}</p>
          <p className="mt-3 text-xs opacity-80">
            Check that DEMO_MODE=1, INTEGRATION_MODE=demo, and DATABASE_URL points at a reachable
            Mongo cluster.
          </p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Connecting to both systems…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <ConsoleHeader state={state} busy={busy} onReset={reset} onForce={forceTick} />

      <div className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6">
        <StatsRow state={state} />

        {!state.seeded && (
          <div className="mb-4 rounded-lg border border-warning-soft bg-warning-soft p-4 text-sm text-warning-text">
            Both systems are empty. Press <strong>Reset &amp; seed</strong> to lay down a starting
            state and the beat will begin.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <SourcePanel rows={state.source} session={state.sessions.joblogic} db={state.databases.source} />
          <LedgerPanel rows={state.ledger} db={state.databases.ledger} />
          <TargetPanel rows={state.target} session={state.sessions.concerto} db={state.databases.target} />
        </div>

        <HonestyNote />
      </div>
    </div>
  );
}

// --- Header ------------------------------------------------------------------

function ConsoleHeader({
  state,
  busy,
  onReset,
  onForce,
}: {
  state: DemoState;
  busy: boolean;
  onReset: () => void;
  onForce: () => void;
}) {
  const countdown = useCountdown(state.tick.nextTickInMs, state.tick.lastTickAt);
  const seconds = Math.ceil(countdown / 1000);
  const imminent = countdown < 3_000;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-base font-semibold text-navy-800">
            Live sync
            <span className="font-normal text-muted-foreground">Joblogic</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="font-normal text-muted-foreground">Concerto</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Two separate databases. ProofSync&rsquo;s real sync engine between them, every{' '}
            {state.tick.tickSeconds} seconds.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Next beat</span>
          <span
            className={cn(
              'inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-full px-2 font-mono text-sm tabular-nums',
              imminent ? 'bg-info-soft text-info-text animate-pulse-soft' : 'bg-muted text-foreground',
            )}
          >
            {seconds}s
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            beat {state.tick.tickCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onForce} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Zap />}
            Force a beat
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
            <RotateCcw />
            Reset &amp; seed
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Local countdown between polls so the number moves every second rather than
 * jumping in 2s steps. Re-syncs to the server whenever a fresh beat lands —
 * the server owns the cadence, this only smooths the display.
 */
function useCountdown(nextTickInMs: number, lastTickAt: string | null) {
  const [remaining, setRemaining] = useState(nextTickInMs);

  useEffect(() => {
    setRemaining(nextTickInMs);
  }, [nextTickInMs, lastTickAt]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 250));
    }, 250);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

// --- Stats -------------------------------------------------------------------

function StatsRow({ state }: { state: DemoState }) {
  const { stats } = state;
  const items: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }[] = [
    { label: 'Jobs in Joblogic', value: String(stats.sourceTotal) },
    { label: 'Still on site', value: String(stats.sourceInFlight) },
    { label: 'Completed', value: String(stats.sourceComplete) },
    { label: 'Synced to Concerto', value: String(stats.synced), tone: 'success' },
    { label: 'Partial', value: String(stats.partial), tone: stats.partial ? 'warning' : undefined },
    {
      label: 'Needs a human',
      value: String(stats.openExceptions),
      tone: stats.openExceptions ? 'danger' : undefined,
    },
    { label: 'Re-keying avoided', value: `${stats.adminMinutesSaved} min` },
  ];

  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div
            className={cn(
              'mt-0.5 text-xl font-semibold tabular-nums',
              item.tone === 'success' && 'text-success-text',
              item.tone === 'warning' && 'text-warning-text',
              item.tone === 'danger' && 'text-danger-text',
              !item.tone && 'text-navy-800',
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Panel shell -------------------------------------------------------------

function Panel({
  title,
  subtitle,
  db,
  session,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  db: string;
  session?: { username: string } | null;
  accent: 'source' | 'engine' | 'target';
  children: React.ReactNode;
}) {
  const accentClass = {
    source: 'border-t-navy-800',
    engine: 'border-t-info',
    target: 'border-t-success',
  }[accent];

  return (
    <section className={cn('flex flex-col rounded-lg border border-t-4 border-border bg-card', accentClass)}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-navy-800">{title}</h2>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-mono">
            <Database className="size-3" />
            {db}
          </span>
          {session !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" />
              {session ? `signed in — ${session.username}` : 'not signed in'}
            </span>
          )}
        </div>
      </div>
      <div className="max-h-[62vh] divide-y divide-border overflow-y-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

// --- Source panel ------------------------------------------------------------

const SOURCE_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  Allocated: 'neutral',
  Travelling: 'info',
  'On Site': 'warning',
  Complete: 'success',
};

function SourcePanel({
  rows,
  session,
  db,
}: {
  rows: SourceRow[];
  session: { username: string } | null;
  db: string;
}) {
  const versions = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.jobNumber, `${r.status}:${r.revision}:${r.updatedAt}`])),
    [rows],
  );
  const changed = useChangedRows(versions);

  return (
    <Panel
      title="Joblogic"
      subtitle="contractor's system"
      db={db}
      session={session}
      accent="source"
    >
      {rows.length === 0 && <EmptyRow>No jobs yet.</EmptyRow>}
      {rows.map((row) => (
        <div
          key={row.jobNumber}
          className={cn(
            'px-4 py-3 transition-colors duration-700',
            changed.has(row.jobNumber) && 'bg-info-soft',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-xs font-medium text-navy-800">{row.jobNumber}</span>
            <Badge tone={SOURCE_TONE[row.status] ?? 'neutral'} dot>
              {row.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">{row.description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.siteName}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{row.engineerName ?? 'unassigned'}</span>
            {row.customerOrderRef ? (
              <span className="font-mono">{row.customerOrderRef}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-danger-text">
                <FileWarning className="size-3" />
                no client reference
              </span>
            )}
            {row.completedAt && <span>completed {timeAgo(row.completedAt)}</span>}
          </div>
        </div>
      ))}
    </Panel>
  );
}

// --- Ledger panel ------------------------------------------------------------

const RUN_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  SUCCESS: 'success',
  PARTIAL: 'warning',
  FAILED: 'danger',
  EXCEPTION: 'warning',
  QUEUED: 'neutral',
};

function LedgerPanel({ rows, db }: { rows: LedgerRow[]; db: string }) {
  const versions = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, `${r.status}:${r.completedAt ?? ''}`])),
    [rows],
  );
  const changed = useChangedRows(versions);

  return (
    <Panel title="ProofSync" subtitle="the sync ledger" db={db} accent="engine">
      {rows.length === 0 && <EmptyRow>Nothing synced yet — waiting for completed work.</EmptyRow>}
      {rows.map((row) => {
        const inFlight = !['SUCCESS', 'PARTIAL', 'FAILED', 'EXCEPTION'].includes(row.status);
        return (
          <div
            key={row.id}
            className={cn(
              'px-4 py-3 transition-colors duration-700',
              changed.has(row.id) && 'bg-info-soft',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-navy-800">
                {row.jobNumber}
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className={cn(!row.reference && 'text-danger-text')}>
                  {row.reference ?? '—'}
                </span>
              </span>
              <Badge tone={RUN_TONE[row.status] ?? 'info'} dot={inFlight}>
                {inFlight && <Loader2 className="size-3 animate-spin" />}
                {humanise(row.status)}
              </Badge>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {row.durationMs != null && <span>{formatDuration(row.durationMs)}</span>}
              {row.fieldsUpdated > 0 && (
                <span className="inline-flex items-center gap-1 text-success-text">
                  <CheckCircle2 className="size-3" />
                  {row.fieldsUpdated} field{row.fieldsUpdated === 1 ? '' : 's'} written
                </span>
              )}
              {row.documentsTransferred > 0 && <span>{row.documentsTransferred} doc(s)</span>}
              {row.attemptNumber > 1 && <span>attempt {row.attemptNumber}</span>}
              {row.startedAt && <span>{timeAgo(row.startedAt)}</span>}
            </div>

            {row.errorMessage && (
              <p className="mt-1.5 rounded border border-danger-soft bg-danger-soft px-2 py-1 text-[11px] leading-snug text-danger-text">
                {row.errorCode ? <strong className="font-mono">{row.errorCode}</strong> : null}
                {row.errorCode ? ' — ' : null}
                {row.errorMessage}
              </p>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

// --- Target panel ------------------------------------------------------------

const TARGET_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  'Awaiting Contractor': 'neutral',
  'In Progress': 'info',
  Completed: 'success',
  Closed: 'neutral',
};

function TargetPanel({
  rows,
  session,
  db,
}: {
  rows: TargetRow[];
  session: { username: string } | null;
  db: string;
}) {
  const versions = useMemo(
    () =>
      Object.fromEntries(
        rows.map((r) => [r.reference, `${r.status}:${r.populatedFields.length}:${r.updatedAt}`]),
      ),
    [rows],
  );
  const changed = useChangedRows(versions);

  return (
    <Panel title="Concerto" subtitle="client's system" db={db} session={session} accent="target">
      {rows.length === 0 && <EmptyRow>No work orders yet.</EmptyRow>}
      {rows.map((row) => (
        <div
          key={row.reference}
          className={cn(
            'px-4 py-3 transition-colors duration-700',
            changed.has(row.reference) && 'bg-success-soft',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-xs font-medium text-navy-800">{row.reference}</span>
            <Badge tone={TARGET_TONE[row.status] ?? 'neutral'} dot>
              {row.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">{row.summary}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.propertyName}</p>

          {row.populatedFields.length === 0 ? (
            <p className="mt-2 rounded border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">
              Empty — waiting for the contractor&rsquo;s paperwork
            </p>
          ) : (
            <dl className="mt-2 space-y-1 rounded border border-success-soft bg-success-soft/50 px-2 py-1.5">
              {row.populatedFields.map((f) => (
                <div key={f.field} className="text-[11px] leading-snug">
                  <dt className="inline font-medium text-success-text">{f.label}: </dt>
                  <dd className="inline text-foreground/80">{f.preview}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {row.documentCount > 0 && <span>{row.documentCount} document(s)</span>}
            {row.emptyFieldCount > 0 && <span>{row.emptyFieldCount} field(s) still blank</span>}
            {row.lastUpdatedBy && <span>updated by {row.lastUpdatedBy}</span>}
            <span>{timeAgo(row.updatedAt)}</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// --- Honesty -----------------------------------------------------------------

/**
 * Non-negotiable. The demo proves a great deal and it is tempting to let a
 * viewer assume it proves the rest. This states the boundary on the same screen
 * as the claim, so nobody has to be told later that they misunderstood.
 */
function HonestyNote() {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <p>
        <strong className="text-foreground">What this proves.</strong> Two separate databases stand
        in for the two systems. Everything between them is ProofSync&rsquo;s production code — the
        same change detection, field mapping, client rules, idempotency ledger, verification
        read-back, retry policy and audit trail that a live deployment runs. The records you can see
        moving are real records being written into a database ProofSync does not otherwise touch.
      </p>
      <p className="mt-2">
        <strong className="text-foreground">What it does not prove.</strong> The connectors reach
        those databases directly. The sign-in you can see is a modelled session, not a browser
        driving a real Joblogic or Concerto login. Where a vendor exposes no API, that access method
        is the remaining piece of work — it swaps in behind the same connector interface, without
        changing anything you are watching here.
      </p>
    </div>
  );
}

function humanise(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}
