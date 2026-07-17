'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Chrome,
  Cog,
  Database,
  ExternalLink,
  FileWarning,
  Loader2,
  Lock,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDuration, formatTime, timeAgo } from '@/lib/utils';
import type { DemoState, LedgerRow, SourceRow, TargetRow } from '@/lib/demo/state';
import type { ShotSummary } from '@/lib/demo/screenshots';
import { useChangedRows, useDemoState, type ActivityLine } from './use-demo-state';

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
  const { state, error, busy, activity, reset, forceTick } = useDemoState();

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
        <Explainer tickSeconds={state.tick.tickSeconds} busy={busy} onForce={forceTick} />
        <FlowDeck ledger={state.ledger} />
        <ActivityFeed activity={activity} />
        <StatsRow state={state} />

        {!state.seeded && (
          <div className="mb-4 rounded-lg border border-warning-soft bg-warning-soft p-4 text-sm text-warning-text">
            Both systems are empty. Press <strong>Start over</strong> to lay down a fresh set of
            jobs, and the syncing will begin.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <SourcePanel
            rows={state.source}
            session={state.sessions.joblogic}
            db={state.databases.source}
            systemUrl={state.systemUrls.source}
            transport={state.transport}
          />
          <LedgerPanel rows={state.ledger} db={state.databases.ledger} />
          <TargetPanel
            rows={state.target}
            session={state.sessions.concerto}
            db={state.databases.target}
            systemUrl={state.systemUrls.target}
            transport={state.transport}
          />
        </div>

        {/* The "what this does / doesn't prove" note is only shown in the local
            browser-drive mode, where that distinction matters to whoever is
            running it. The public hosted demo (direct) leads with the plain
            explainer above instead. */}
        {state.transport === 'browser' && <HonestyNote transport={state.transport} />}
      </div>
    </div>
  );
}

/**
 * Plain-English "what am I looking at". A stranger should understand the whole
 * demo from this one paragraph, without knowing anything about the product.
 */
function Explainer({
  tickSeconds,
  busy,
  onForce,
}: {
  tickSeconds: number;
  busy: boolean;
  onForce: () => void;
}) {
  return (
    <section className="my-4 grid gap-5 rounded-lg border border-border bg-card px-5 py-5 lg:grid-cols-[auto_1fr] lg:items-center">
      {/* The demo's headline control — left, big and obvious, so a presenter can
          smack it and make a batch of real jobs land on cue. */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onForce}
          disabled={busy}
          className={cn(
            'group flex w-full items-center justify-center gap-3 rounded-xl bg-success px-10 py-6 text-xl font-bold text-white shadow-lg shadow-success/25 transition-all lg:w-[17rem]',
            'hover:bg-success-text hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-success/30',
            'disabled:cursor-not-allowed disabled:opacity-70',
            !busy && 'animate-pulse-soft',
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-7 animate-spin" />
              Syncing&hellip;
            </>
          ) : (
            <>
              <Zap className="size-7 transition-transform group-hover:scale-110" />
              Run a sync now
            </>
          )}
        </button>
        <span className="text-xs text-muted-foreground">or watch it run on its own</span>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy-800">What you&rsquo;re watching</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A live demonstration. On the <strong className="text-foreground">left</strong> is a
          contractor&rsquo;s job system, where engineers record the work they&rsquo;ve finished. On the{' '}
          <strong className="text-foreground">right</strong> is their client&rsquo;s facilities
          system, which needs those same details. The two don&rsquo;t talk to each other. Every{' '}
          {tickSeconds} seconds, <strong className="text-foreground">ProofSync</strong> (the middle
          column) checks the left system for newly-completed jobs and copies each one into the right
          system &mdash; filling in the details, checking its own work, and setting aside anything
          that needs a person.
        </p>
      </div>
    </section>
  );
}

/**
 * The visual centrepiece: jobs fly across as chips.
 *
 * Every job that finishes a sync launches a chip that travels from the Joblogic
 * side, through the ProofSync hub, into Concerto — turning "some rows changed"
 * into a thing you can watch move. Jobs that fail veer to the hub and drop out,
 * so an exception reads as "it didn't make it across" at a glance.
 */
const FLOW_KEYFRAMES = `
@keyframes psFly {
  0%   { left: 4%;  opacity: 0; }
  10%  { opacity: 1; }
  50%  { transform: translate(-50%, -16px) scale(1.06); }
  90%  { opacity: 1; }
  100% { left: 94%; opacity: 0; }
}
@keyframes psFlag {
  0%   { left: 4%;  top: var(--lane); opacity: 0; }
  12%  { opacity: 1; }
  50%  { left: 49%; top: var(--lane); opacity: 1; transform: translate(-50%, 0) scale(1.06); }
  100% { left: 49%; top: 150%; opacity: 0; transform: translate(-50%, 0) scale(0.8); }
}
@keyframes psGear { to { transform: rotate(360deg); } }
@keyframes psHubPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(29,78,216,.35); } 50% { box-shadow: 0 0 0 10px rgba(29,78,216,0); } }
.ps-chip { animation-timing-function: cubic-bezier(.55,.1,.45,.9); animation-fill-mode: forwards; }
@media (prefers-reduced-motion: reduce) {
  .ps-chip { animation-duration: 1ms !important; }
  .ps-gear { animation: none !important; }
}
`;

interface FlowChip {
  id: number;
  label: string;
  kind: 'ok' | 'flag';
  lane: number;
}

const TERMINAL = ['SUCCESS', 'PARTIAL', 'FAILED', 'EXCEPTION'];
const LANES = [26, 58, 90]; // px from the top of the band, three lanes

function FlowDeck({ ledger }: { ledger: LedgerRow[] }) {
  const [chips, setChips] = useState<FlowChip[]>([]);
  const [active, setActive] = useState(false);
  const seen = useRef<Map<string, string> | null>(null);
  const chipId = useRef(0);
  const laneIx = useRef(0);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const first = seen.current === null;
    const prev = seen.current ?? new Map<string, string>();
    const next = new Map<string, string>();
    const fresh: FlowChip[] = [];

    for (const r of ledger) {
      next.set(r.id, r.status);
      const wasTerminal = TERMINAL.includes(prev.get(r.id) ?? '');
      const isTerminal = TERMINAL.includes(r.status);
      // A job that has just reached a terminal state is a job that just crossed
      // (or just failed). First render seeds the set without launching anything,
      // so opening the page doesn't fire a chip for every historic row.
      if (!first && isTerminal && !wasTerminal) {
        fresh.push({
          id: chipId.current++,
          label: r.reference ? `${r.jobNumber} → ${r.reference}` : r.jobNumber,
          kind: r.status === 'SUCCESS' || r.status === 'PARTIAL' ? 'ok' : 'flag',
          lane: LANES[laneIx.current++ % LANES.length]!,
        });
      }
    }
    seen.current = next;

    if (fresh.length) {
      setChips((c) => [...c, ...fresh]);
      setActive(true);
      if (activeTimer.current) clearTimeout(activeTimer.current);
      activeTimer.current = setTimeout(() => setActive(false), 1900);
      for (const ch of fresh) {
        setTimeout(() => setChips((c) => c.filter((x) => x.id !== ch.id)), 2000);
      }
    }
  }, [ledger]);

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-muted/30">
      <style>{FLOW_KEYFRAMES}</style>
      <div className="relative h-[132px]">
        {/* the connecting track */}
        <div className="absolute inset-x-[6%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-navy-200 via-info/40 to-success/50" />

        {/* end zones + hub */}
        <div className="absolute left-4 top-3 text-[11px] font-semibold uppercase tracking-wide text-navy-700">
          Joblogic
          <div className="mt-0.5 text-[10px] font-normal normal-case text-muted-foreground">contractor · jobs done</div>
        </div>
        <div className="absolute right-4 top-3 text-right text-[11px] font-semibold uppercase tracking-wide text-success-text">
          Concerto
          <div className="mt-0.5 text-[10px] font-normal normal-case text-muted-foreground">client · updated</div>
        </div>

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div
            className="flex size-12 items-center justify-center rounded-full border border-info/30 bg-card"
            style={{ animation: active ? 'psHubPulse 1s ease-out infinite' : undefined }}
          >
            <Cog
              className="ps-gear size-6 text-info"
              style={{ animation: `psGear ${active ? '1.1s' : '4s'} linear infinite` }}
            />
          </div>
          <span className="mt-1.5 text-[11px] font-semibold text-navy-800">ProofSync</span>
        </div>

        {/* flying chips */}
        {chips.map((ch) => (
          <span
            key={ch.id}
            className={cn(
              'ps-chip pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-lg',
              ch.kind === 'ok'
                ? 'bg-info text-white shadow-info/30'
                : 'bg-warning text-white shadow-warning/30',
            )}
            style={
              {
                top: ch.kind === 'ok' ? `${ch.lane}px` : undefined,
                ['--lane' as string]: `${ch.lane}px`,
                animation: `${ch.kind === 'ok' ? 'psFly' : 'psFlag'} ${ch.kind === 'ok' ? '1.9s' : '1.6s'}`,
              } as React.CSSProperties
            }
          >
            {ch.kind === 'flag' && <FileWarning className="mr-1 inline size-3 align-[-2px]" />}
            {ch.label}
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * A running commentary of what each sync just did, in words. Without this the
 * panels merely "change"; with it, a viewer can see the story.
 */
function ActivityFeed({ activity }: { activity: ActivityLine[] }) {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live activity
        </span>
      </div>
      <ul className="divide-y divide-border">
        {activity.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Watching the contractor&rsquo;s system for completed jobs&hellip;
          </li>
        )}
        {activity.map((line, i) => (
          <li
            key={line.id}
            className={cn(
              'flex items-baseline gap-3 px-4 py-2.5 text-sm transition-colors',
              i === 0 && 'bg-info-soft/40',
            )}
          >
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{line.time}</span>
            <span className={cn(line.tone === 'flag' ? 'text-warning-text' : 'text-foreground')}>
              {line.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
            Two separate systems, checked and kept in step every {state.tick.tickSeconds} seconds.
          </p>
        </div>

        {state.transport === 'browser' && <TransportBadge transport={state.transport} />}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Next check</span>
          <span
            className={cn(
              'inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-full px-2 font-mono text-sm tabular-nums',
              imminent ? 'bg-info-soft text-info-text animate-pulse-soft' : 'bg-muted text-foreground',
            )}
          >
            {seconds}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onForce} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Zap />}
            Run a sync now
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
            <RotateCcw />
            Start over
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * States the access method in the header, permanently.
 *
 * The two transports prove very different things, and the difference is
 * invisible from the panels alone — the records move identically either way.
 * Anyone reading this screen is entitled to know which one they are watching
 * without having to ask.
 */
function TransportBadge({ transport }: { transport: DemoState['transport'] }) {
  if (transport === 'browser') {
    return (
      <Badge tone="success" className="gap-1.5">
        <Chrome className="size-3" />
        Browser — signing in and typing into both systems
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" className="gap-1.5">
      <Database className="size-3" />
      Direct — database transport, login simulated
    </Badge>
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
  systemUrl,
  children,
}: {
  title: string;
  subtitle: string;
  db: string;
  session?: { username: string } | null;
  accent: 'source' | 'engine' | 'target';
  /** Link to the stand-in system's own UI — the screen the browser drives. */
  systemUrl?: string;
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
          {systemUrl && (
            // Let anyone doubting the demo go and look at the system themselves.
            <a
              href={systemUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-info-text hover:underline"
            >
              <ExternalLink className="size-3" />
              open the system
            </a>
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
  systemUrl,
  transport,
}: {
  rows: SourceRow[];
  session: { username: string } | null;
  db: string;
  systemUrl: string;
  transport: DemoState['transport'];
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
      // In browser mode the session shown in the header belongs to Chromium, not
      // to this simulated store — so don't display a session that isn't the one
      // doing the work.
      session={transport === 'browser' ? undefined : session}
      systemUrl={systemUrl}
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
  const [lightbox, setLightbox] = useState<ShotSummary | null>(null);
  const versions = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, `${r.status}:${r.completedAt ?? ''}:${r.shots.length}`])),
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

            {row.shots.length > 0 && <Evidence shots={row.shots} onOpen={setLightbox} />}
          </div>
        );
      })}

      {lightbox && <Lightbox shot={lightbox} onClose={() => setLightbox(null)} />}
    </Panel>
  );
}

/**
 * Screenshot evidence for one sync.
 *
 * A headed browser is persuasive in the room and gone when the window closes.
 * This is what survives: the actual pixels of the client's system at the moment
 * ProofSync wrote to it. It is the difference between "we did this" and "here,
 * look".
 */
function Evidence({ shots, onOpen }: { shots: ShotSummary[]; onOpen: (s: ShotSummary) => void }) {
  return (
    <div className="mt-2">
      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Camera className="size-3" />
        what was on screen
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shots.map((shot) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => onOpen(shot)}
            title={shot.caption}
            className="group relative overflow-hidden rounded border border-border transition-colors hover:border-info"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/demo/shot/${shot.id}`}
              alt={shot.caption}
              loading="lazy"
              className="h-12 w-20 object-cover object-top"
            />
            <span className="absolute inset-x-0 bottom-0 bg-navy-900/75 px-1 py-0.5 text-[8px] leading-tight text-white">
              {shot.stage.replace(/-/g, ' ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Lightbox({ shot, onClose }: { shot: ShotSummary; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shot.caption}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-5xl overflow-hidden rounded-lg bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-800">{shot.caption}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{shot.url}</p>
          </div>
          <span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground">
            {formatTime(shot.capturedAt)}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/demo/shot/${shot.id}`}
          alt={shot.caption}
          className="max-h-[75vh] w-full object-contain"
        />
      </div>
    </div>
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
  systemUrl,
  transport,
}: {
  rows: TargetRow[];
  session: { username: string } | null;
  db: string;
  systemUrl: string;
  transport: DemoState['transport'];
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
    <Panel
      title="Concerto"
      subtitle="client's system"
      db={db}
      session={transport === 'browser' ? undefined : session}
      systemUrl={systemUrl}
      accent="target"
    >
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
 * Non-negotiable, and different per transport.
 *
 * The two transports prove genuinely different things, and the panels look
 * identical either way — so a note that didn't change with the transport would
 * be worse than none at all. This states the real boundary on the same screen as
 * the claim, so nobody has to be told later that they misunderstood.
 */
function HonestyNote({ transport }: { transport: DemoState['transport'] }) {
  if (transport === 'browser') {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">What this proves.</strong> Two separate systems, each
          with its own database, its own login and its own web interface. ProofSync reaches both the
          way a person does and nothing else: a real Chromium signs in at each login form, reads the
          completed job off the rendered page, opens the client&rsquo;s work order, types into the
          form, clicks Save, and re-reads the page to confirm what actually stuck. No API is
          involved anywhere. Between those screens sits ProofSync&rsquo;s production engine —
          the same field mapping, client rules, idempotency ledger, retry policy and audit trail a
          live deployment runs. The screenshots are the evidence, taken at the moment of each write.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">What it does not prove.</strong> The two systems are
          stand-ins we built, so their screens behave. It does not prove that the real Joblogic or
          Concerto can be driven this way — nor that doing so is permitted by their terms, survives
          MFA, or withstands a UI redesign. Document upload is the one step still not done through
          the screen. And this transport cannot run on Vercel: it needs a real browser, so it is a
          local or containerised-worker capability, not something the hosted demo does.
        </p>
      </div>
    );
  }

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
        driving a real login. Set <code className="font-mono">DEMO_TRANSPORT=browser</code> to watch
        it do the whole thing through the screens instead.
      </p>
    </div>
  );
}

function humanise(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}
