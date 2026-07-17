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
  // Work orders a worker is filling right now (from the theatre), so the Concerto
  // panel can highlight the SAME job the card is processing.
  const [activeRefs, setActiveRefs] = useState<Set<string>>(new Set());

  // Two acts. Act 1 follows ONE real job end to end at human speed, so a viewer
  // understands exactly what happens. Act 2 reveals the same thing running flat
  // out across the whole floor — the "oh, it's doing that to all of them" moment.
  const [act, setAct] = useState<'human' | 'machine'>('human');
  // Snapshot taken when the machine floor opens, so the finale can state the REAL
  // delta over the exact window the viewer watched — nothing invented.
  const [baseline, setBaseline] = useState<{ done: number; minutes: number; at: number } | null>(
    null,
  );
  const [finale, setFinale] = useState<{ jobs: number; minutes: number; seconds: number } | null>(
    null,
  );

  // The hero job for Act 1: the most recent real sync that actually wrote fields
  // into the client's work order. The ledger row now carries those fields itself,
  // so this no longer depends on the job being in the (windowed) target panel —
  // which is why it used to sit forever on "the first job is landing…".
  const hero = useMemo<HeroJob | null>(() => {
    if (!state) return null;
    const led = state.ledger.find(
      (r) =>
        (r.status === 'SUCCESS' || r.status === 'PARTIAL') &&
        r.reference &&
        r.targetFields.length > 0,
    );
    return led ? { led } : null;
  }, [state]);

  // A completed job already sitting in the source system, shown while the first
  // real sync is still landing — so Act 1 is alive and on-message within a second
  // of load instead of a bare spinner. Seeded jobs exist long before the first
  // sync finishes on the slow demo cluster.
  const pending = useMemo(
    () => state?.source.find((s) => s.status === 'Complete') ?? null,
    [state],
  );

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

  const enterMachine = () => {
    setBaseline({
      done: state.stats.synced + state.stats.partial,
      minutes: state.stats.adminMinutesSaved,
      at: Date.now(),
    });
    setAct('machine');
  };

  const freeze = () => {
    if (!baseline) return;
    setFinale({
      jobs: Math.max(0, state.stats.synced + state.stats.partial - baseline.done),
      minutes: Math.max(0, state.stats.adminMinutesSaved - baseline.minutes),
      seconds: Math.max(1, Math.round((Date.now() - baseline.at) / 1000)),
    });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <ConsoleHeader state={state} busy={busy} onReset={reset} onForce={forceTick} act={act} />

      <div className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6">
        {act === 'human' ? (
          <SpotlightStage
            hero={hero}
            pending={pending}
            tickSeconds={state.tick.tickSeconds}
            seeded={state.seeded}
            onScaleUp={enterMachine}
          />
        ) : (
          <MachineFloor
            state={state}
            activity={activity}
            activeRefs={activeRefs}
            onActive={setActiveRefs}
            busy={busy}
            onForce={forceTick}
            onBack={() => setAct('human')}
            onFreeze={freeze}
          />
        )}

        {/* The "what this does / doesn't prove" note is only shown in the local
            browser-drive mode, where that distinction matters to whoever is
            running it. */}
        {state.transport === 'browser' && <HonestyNote transport={state.transport} />}
      </div>

      {finale && <FinaleCard data={finale} onClose={() => setFinale(null)} />}
    </div>
  );
}

interface HeroJob {
  led: LedgerRow;
}

// --- Act 1: the spotlight ----------------------------------------------------

const SPOT_NODES = [
  { icon: Database, label: 'Joblogic', sub: 'job completed' },
  { icon: Cog, label: 'ProofSync', sub: 'reads & matches' },
  { icon: Chrome, label: 'Concerto', sub: 'fills the form' },
  { icon: CheckCircle2, label: 'Verified', sub: 'read back' },
];

/**
 * Act 1. One real, recently-synced job, walked across the four stops slowly
 * enough that a stranger understands exactly what ProofSync does. Every value on
 * screen is the job's real data; only the pacing is choreographed.
 */
function SpotlightStage({
  hero,
  pending,
  tickSeconds,
  seeded,
  onScaleUp,
}: {
  hero: HeroJob | null;
  pending: SourceRow | null;
  tickSeconds: number;
  seeded: boolean;
  onScaleUp: () => void;
}) {
  const latest = useRef(hero);
  latest.current = hero;
  const [job, setJob] = useState<HeroJob | null>(hero);
  const [stage, setStage] = useState(0);
  const [gen, setGen] = useState(0);

  // Adopt a hero the moment one becomes available.
  useEffect(() => {
    if (!job && latest.current) {
      setJob(latest.current);
      setGen((g) => g + 1);
    }
  }, [job, hero]);

  // Choreograph the current job across the four stops, then hold and pick up the
  // freshest real job — so a lingering presenter always sees a live record.
  useEffect(() => {
    if (!job) return;
    setStage(0);
    const fields = job.led.targetFields.length;
    const durs = [1700, 1900, Math.max(2400, 800 + fields * 320), 1800];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    durs.forEach((d, i) => {
      acc += d;
      timers.push(setTimeout(() => setStage(i + 1), acc));
    });
    timers.push(
      setTimeout(() => {
        setJob(latest.current ?? job);
        setGen((g) => g + 1);
      }, acc + 3600),
    );
    return () => timers.forEach(clearTimeout);
  }, [job, gen]);

  const stop = Math.min(stage, 3);
  const progress = (Math.min(stage, 3) / 3) * 100;
  const done = stage >= 3;

  return (
    <section className="relative my-4 overflow-hidden rounded-2xl border border-navy-900/50 bg-[radial-gradient(130%_130%_at_50%_-10%,#2a2f6e_0%,#1b1e49_45%,#111330_100%)] px-5 py-6 shadow-xl sm:px-8 sm:py-8">
      <style>{THEATRE_KEYFRAMES}</style>
      <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-56 w-3/4 rounded-full bg-info/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-info/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-info-soft">
          Act 1 · Human speed
        </span>
        <h2 className="text-lg font-semibold text-white sm:text-xl">Follow one job across both systems</h2>
        <span className="ml-auto hidden text-xs text-white/40 lg:inline">
          real data · slowed down so you can see every step
        </span>
      </div>

      {!job ? (
        pending ? (
          <PreHero pending={pending} />
        ) : (
          <div className="relative mt-8 flex h-56 flex-col items-center justify-center gap-3 text-white/50">
            {seeded ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">Watching for the next completed job…</span>
              </>
            ) : (
              <span className="max-w-sm text-center text-sm">
                Both systems are empty. Press <strong className="text-white/80">Start over</strong> in
                the header to lay down a fresh set of jobs.
              </span>
            )}
          </div>
        )
      ) : (
        <>
          <SpotRail stage={stage} progress={progress} />

          {/* The focus card — what is happening at the current stop, in detail. */}
          <div className="relative mx-auto mt-7 max-w-2xl">
            <SpotlightFocus led={job.led} stop={stop} />
          </div>

          {/* The bridge into Act 2. */}
          <div
            className={cn(
              'relative mx-auto mt-7 max-w-2xl text-center transition-all duration-500',
              done ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <p className="text-sm text-white/70">
              That was <strong className="text-white">one</strong> job — about {tickSeconds} seconds of
              work a person never had to do. Now imagine it never stopping.
            </p>
            <button
              type="button"
              onClick={onScaleUp}
              className="group mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:from-indigo-400 hover:to-blue-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-info/40"
            >
              <Zap className="size-5 transition-transform group-hover:scale-110" />
              Now watch it at machine speed
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** The travelling rail: four stops, a filling track and a moving marker. */
function SpotRail({ stage, progress }: { stage: number; progress: number }) {
  return (
    <div className="relative mt-7 px-2">
      <div className="absolute left-[9%] right-[9%] top-5 h-0.5 rounded bg-white/15" />
      <div
        className="absolute left-[9%] top-5 h-0.5 rounded bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-700 ease-out"
        style={{ width: `calc((100% - 18%) * ${progress / 100})` }}
      />
      <div className="relative grid grid-cols-4">
        {SPOT_NODES.map((node, i) => {
          const status = stage > i ? 'done' : stage === i ? 'active' : 'todo';
          const Icon = status === 'done' ? CheckCircle2 : node.icon;
          return (
            <div key={node.label} className="flex flex-col items-center text-center">
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-full ring-2 transition-all duration-500',
                  status === 'done' && 'bg-emerald-500 text-white ring-emerald-400',
                  status === 'active' &&
                    'bg-white text-navy-900 ring-white shadow-lg shadow-info/40 scale-110 animate-pulse-soft',
                  status === 'todo' && 'bg-white/5 text-white/40 ring-white/15',
                )}
              >
                <Icon className="size-5" />
              </span>
              <span
                className={cn(
                  'mt-2 text-xs font-semibold',
                  status === 'todo' ? 'text-white/40' : 'text-white',
                )}
              >
                {node.label}
              </span>
              <span className="text-[10px] text-white/40">{node.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Shown while the first real sync is still landing: a completed job being read. */
function PreHero({ pending }: { pending: SourceRow }) {
  return (
    <>
      <SpotRail stage={1} progress={(1 / 3) * 100} />
      <div className="relative mx-auto mt-7 max-w-2xl">
        <FocusCard
          chip="Joblogic"
          chipTone="slate"
          title={pending.jobNumber}
          badge={<Badge tone="success" dot>Completed on site</Badge>}
        >
          <p className="text-sm font-medium text-foreground">{pending.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Fact label="Site" value={pending.siteName} />
            <Fact label="Engineer" value={pending.engineerName ?? '—'} />
            <Fact
              label="Completed"
              value={pending.completedAt ? timeAgo(pending.completedAt) : 'just now'}
            />
            <Fact label="Client ref" value={pending.customerOrderRef ?? '—'} />
          </dl>
          <p className="mt-3 flex items-center gap-2 rounded-md bg-info-soft px-2.5 py-1.5 text-[11px] text-info-text">
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ProofSync is signing in and reading this now…
          </p>
        </FocusCard>
      </div>
    </>
  );
}

/** The morphing detail card under the Act 1 rail. */
function SpotlightFocus({ led, stop }: { led: LedgerRow; stop: number }) {
  if (stop === 0) {
    return (
      <FocusCard
        chip="Joblogic"
        chipTone="slate"
        title={led.jobNumber}
        badge={<Badge tone="success" dot>Completed on site</Badge>}
      >
        <p className="text-sm font-medium text-foreground">{led.summary}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Fact label="Site" value={led.propertyName} />
          <Fact label="Engineer" value={led.engineerName ?? '—'} />
          <Fact label="Completed" value={led.jobCompletedAt ? timeAgo(led.jobCompletedAt) : 'just now'} />
          <Fact label="Paperwork" value={`${led.documentCount} document(s) attached`} />
        </dl>
        <p className="mt-3 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Finished in Joblogic. The client&rsquo;s system knows nothing about it yet — today a person
          would re-key all of this by hand.
        </p>
      </FocusCard>
    );
  }

  if (stop === 1) {
    return (
      <FocusCard chip="ProofSync" chipTone="indigo" title="Reading it — and finding the match">
        <ul className="space-y-2 text-sm">
          <Step done>Signed in to the client&rsquo;s system</Step>
          <Step done>
            Reference <span className="font-mono text-xs">{led.reference}</span> matched to a work
            order
          </Step>
          <Step done>Client rules loaded — costs withheld by policy</Step>
          <Step>Mapping {led.targetFields.length} field(s) into Concerto&rsquo;s form…</Step>
        </ul>
        <p className="mt-3 rounded-md bg-info-soft px-2.5 py-1.5 text-[11px] text-info-text">
          It refuses to guess: no matching reference means the job is set aside for a person, never
          forced through.
        </p>
      </FocusCard>
    );
  }

  if (stop === 2) {
    return (
      <FocusCard
        chip="Concerto"
        chipTone="teal"
        title={`Filling ${led.reference}`}
        badge={<Badge tone="info" dot>typing it in</Badge>}
      >
        <dl className="space-y-1.5">
          {led.targetFields.map((f, i) => (
            <div
              key={f.field}
              className="ps-row flex items-baseline justify-between gap-3 rounded-md bg-success-soft/50 px-2.5 py-1.5"
              style={{ animationDelay: `${0.2 + i * 0.28}s` }}
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-success-text">
                {f.label}
              </dt>
              <dd className="truncate text-right text-xs font-medium text-foreground">{f.preview}</dd>
            </div>
          ))}
        </dl>
      </FocusCard>
    );
  }

  return (
    <FocusCard
      chip="Verified"
      chipTone="emerald"
      title="Saved — and checked"
      badge={<Badge tone="success" dot>done</Badge>}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            {led.targetFields.length} field(s) written and read back to confirm
            {led.documentsTransferred > 0 ? `, ${led.documentsTransferred} document(s) attached` : ''}.
          </p>
          <p className="text-xs text-muted-foreground">
            {led.durationMs ? `Took ${formatDuration(led.durationMs)}. ` : ''}0 minutes of re-keying.
          </p>
        </div>
      </div>
    </FocusCard>
  );
}

const FOCUS_CHIP: Record<string, string> = {
  slate: 'bg-slate-700 text-white',
  indigo: 'bg-indigo-600 text-white',
  teal: 'bg-teal-600 text-white',
  emerald: 'bg-emerald-600 text-white',
};

function FocusCard({
  chip,
  chipTone,
  title,
  badge,
  children,
}: {
  chip: string;
  chipTone: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            FOCUS_CHIP[chipTone],
          )}
        >
          {chip}
        </span>
        <span className="font-mono text-sm font-semibold text-navy-800">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function Step({ children, done }: { children: React.ReactNode; done?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      ) : (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-info" />
      )}
      <span className={cn(done ? 'text-foreground' : 'text-muted-foreground')}>{children}</span>
    </li>
  );
}

// --- Act 2: the machine floor ------------------------------------------------

/** Act 2. The same engine, now shown running flat out across the whole floor. */
function MachineFloor({
  state,
  activity,
  activeRefs,
  onActive,
  busy,
  onForce,
  onBack,
  onFreeze,
}: {
  state: DemoState;
  activity: ActivityLine[];
  activeRefs: Set<string>;
  onActive: (refs: Set<string>) => void;
  busy: boolean;
  onForce: () => void;
  onBack: () => void;
  onFreeze: () => void;
}) {
  return (
    <>
      <MachineHeader busy={busy} onForce={onForce} onBack={onBack} onFreeze={onFreeze} />
      <KpiBar stats={state.stats} />
      <BrowserTheatre ledger={state.ledger} target={state.target} onActive={onActive} />
      <ActivityFeed activity={activity} />
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
          activeRefs={activeRefs}
        />
      </div>
    </>
  );
}

function MachineHeader({
  busy,
  onForce,
  onBack,
  onFreeze,
}: {
  busy: boolean;
  onForce: () => void;
  onBack: () => void;
  onFreeze: () => void;
}) {
  return (
    <section className="relative my-4 overflow-hidden rounded-2xl border border-navy-900/60 bg-[radial-gradient(130%_130%_at_20%_-20%,#1e2a6e_0%,#141a44_50%,#0c0f26_100%)] px-5 py-5 shadow-xl sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 -top-10 left-1/3 h-56 w-1/2 rounded-full bg-info/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="mr-auto">
          <span className="rounded-full bg-info/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-info-soft">
            Act 2 · Machine speed
          </span>
          <h2 className="mt-1.5 text-lg font-semibold text-white sm:text-xl">
            The same thing — every job, all at once
          </h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
            <span className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-emerald-400 animate-pulse-soft"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </span>
            5 browser workers running in parallel
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onForce} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Zap />}
            Run a sync now
          </Button>
          <button
            type="button"
            onClick={onFreeze}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-navy-900 shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          >
            Freeze — what just happened
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            back to one job
          </button>
        </div>
      </div>
    </section>
  );
}

/** The live KPI counters — big, tabular, and visibly spinning as figures land. */
function KpiBar({ stats }: { stats: DemoState['stats'] }) {
  const synced = useCountUp(stats.synced);
  const minutes = useCountUp(stats.adminMinutesSaved);
  const complete = useCountUp(stats.sourceComplete);
  const flagged = useCountUp(stats.openExceptions);

  const items = [
    { label: 'Synced to Concerto', value: synced.toLocaleString(), tone: 'success' as const },
    { label: 'Minutes of re-keying returned', value: minutes.toLocaleString(), tone: 'info' as const },
    { label: 'Completed on site', value: complete.toLocaleString(), tone: 'plain' as const },
    { label: 'Set aside for a person', value: flagged.toLocaleString(), tone: 'plain' as const },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-xl border px-4 py-3.5 shadow-sm',
            item.tone === 'success' && 'border-success-soft bg-gradient-to-br from-emerald-50 to-teal-50',
            item.tone === 'info' && 'border-info-soft bg-gradient-to-br from-sky-50 to-indigo-50',
            item.tone === 'plain' && 'border-border bg-card',
          )}
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </div>
          <div
            className={cn(
              'mt-1 text-3xl font-bold tabular-nums',
              item.tone === 'success' && 'text-success-text',
              item.tone === 'info' && 'text-info-text',
              item.tone === 'plain' && 'text-navy-800',
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Finale ------------------------------------------------------------------

/** Count from zero to the target on mount, for the finale reveal. */
function BigCount({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setTarget(to), 80);
    return () => clearTimeout(id);
  }, [to]);
  const n = useCountUp(target, 1200);
  return (
    <span className="tabular-nums">
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

/** "While you watched" — the real delta over the exact window Act 2 was open. */
function FinaleCard({
  data,
  onClose,
}: {
  data: { jobs: number; minutes: number; seconds: number };
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/85 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(120%_120%_at_50%_-10%,#233079_0%,#161c4a_55%,#0c0f26_100%)] p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <p className="text-[11px] font-bold uppercase tracking-widest text-info-soft">
          While you watched — {data.seconds}s
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <div className="text-5xl font-black text-white">
              <BigCount to={data.jobs} />
            </div>
            <div className="mt-1 text-sm text-white/60">jobs synced into Concerto</div>
          </div>
          <div>
            <div className="text-5xl font-black text-emerald-400">
              <BigCount to={data.minutes} />
            </div>
            <div className="mt-1 text-sm text-white/60">minutes of re-keying returned</div>
          </div>
          <div>
            <div className="text-5xl font-black text-white">0</div>
            <div className="mt-1 text-sm text-white/60">minutes anyone spent doing it</div>
          </div>
        </div>

        <p className="mt-7 text-sm text-white/70">
          No admin intervention. Nothing typed twice. This was the real engine over two real,
          separate systems — the whole time.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.03]"
        >
          Keep watching
        </button>
      </div>
    </div>
  );
}

/**
 * The visual centrepiece: browser windows pop open and do the work.
 *
 * Every job that finishes a sync pops a little browser window that signs in to
 * the client's system, types the job's REAL field values into the form, saves,
 * and closes — the way a person would where there is no API. Jobs that fail pop
 * a window that can't complete and flags for a human. This visualises ProofSync's
 * browser-login method (built and verified for real) using the actual data;
 * the live Chromium itself only pops when the demo is run on a local machine.
 */
const THEATRE_KEYFRAMES = `
@keyframes psWinLife {
  0%   { transform: translateY(10px) scale(.92); opacity: 0; }
  7%   { opacity: 1; }
  13%  { transform: translateY(0) scale(1); opacity: 1; }
  88%  { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-8px) scale(.96); opacity: 0; }
}
@keyframes psRowIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
@keyframes psSignOff { 0%,18%{opacity:1;} 30%,100%{opacity:0;} }
@keyframes psGear { to { transform: rotate(360deg); } }
.ps-win { animation: psWinLife 3.8s ease forwards; }
.ps-row { opacity: 0; animation: psRowIn .24s ease forwards; }
.ps-sign { animation: psSignOff 3.8s ease forwards; }
@media (prefers-reduced-motion: reduce) {
  /* Snapping a 1ms duration would leave the window at its closed (opacity 0)
     end-state — invisible. Instead disable the motion and hold everything at
     its VISIBLE state; windows still appear and are removed on their timer. */
  .ps-win { animation: none; opacity: 1; }
  .ps-row { animation: none; opacity: 1; }
  .ps-sign { animation: none; opacity: 0; }
  .ps-gear { animation: none !important; }
}
`;

const TERMINAL = ['SUCCESS', 'PARTIAL', 'FAILED', 'EXCEPTION'];
const THEATRE_SLOTS = ['2%', '35%', '68%'];

interface TheatreWindow {
  id: number;
  jobNumber: string;
  reference: string | null;
  kind: 'ok' | 'fail';
  fields: { label: string; value: string }[];
  slot: number;
  detail: 'full' | 'brief';
  lifeMs: number;
}

function BrowserTheatre({
  ledger,
  target,
  onActive,
}: {
  ledger: LedgerRow[];
  target: TargetRow[];
  onActive?: (refs: Set<string>) => void;
}) {
  const [windows, setWindows] = useState<TheatreWindow[]>([]);
  const seen = useRef<Map<string, string> | null>(null);
  const winId = useRef(0);
  const slotIx = useRef(0);
  const fullShown = useRef(0);

  // Tell the Concerto panel which work orders a worker is filling right now, so
  // it can light up the SAME job — you can follow one record across the screen.
  useEffect(() => {
    if (!onActive) return;
    onActive(new Set(windows.filter((w) => w.kind === 'ok' && w.reference).map((w) => w.reference!)));
  }, [windows, onActive]);

  useEffect(() => {
    // The real field values written to this job's work order — so the window
    // shows the actual data being entered, the manual re-keying we automate.
    const fieldsFor = (reference: string | null) => {
      if (!reference) return [];
      const row = target.find((t) => t.reference === reference);
      return (row?.populatedFields ?? []).map((f) => ({ label: f.label, value: f.preview }));
    };
    const makeWin = (r: LedgerRow, detail: 'full' | 'brief'): TheatreWindow => {
      const ok = r.status === 'SUCCESS' || r.status === 'PARTIAL';
      const fields = ok ? fieldsFor(r.reference) : [];
      const gap = detail === 'brief' ? 0.16 : 0.22;
      const life = ok ? 0.5 + fields.length * gap + (detail === 'brief' ? 0.9 : 1.2) : 2.8;
      return {
        id: winId.current++,
        jobNumber: r.jobNumber,
        reference: r.reference,
        kind: ok ? 'ok' : 'fail',
        fields,
        slot: slotIx.current++ % THEATRE_SLOTS.length,
        detail,
        lifeMs: Math.round(life * 1000),
      };
    };
    const removeAfter = (win: TheatreWindow) => {
      setTimeout(() => setWindows((w) => w.filter((x) => x.id !== win.id)), win.lifeMs + 200);
    };

    const first = seen.current === null;
    const prev = seen.current ?? new Map<string, string>();
    const next = new Map<string, string>();
    const fresh: TheatreWindow[] = [];

    for (const r of ledger) {
      next.set(r.id, r.status);
      const wasTerminal = TERMINAL.includes(prev.get(r.id) ?? '');
      const isTerminal = TERMINAL.includes(r.status);
      if (!first && isTerminal && !wasTerminal) {
        // Front-load the theatre: the first couple of syncs get the full
        // step-by-step parade (the "oh, I see what it's doing" moment); after
        // that it settles into a lighter rhythm so it never becomes a repetitive
        // show that outstays its welcome.
        const detail: 'full' | 'brief' = fullShown.current < 2 ? 'full' : 'brief';
        fullShown.current += 1;
        fresh.push(makeWin(r, detail));
      }
    }
    seen.current = next;

    if (first) {
      // Open with a few workers already mid-job, so the stage is busy on arrival
      // rather than "waiting for the next completed job". Uses the most recent
      // real syncs from the ledger.
      const recent = ledger.filter((r) => TERMINAL.includes(r.status)).slice(0, 3);
      const initial = recent.map((r) => makeWin(r, fullShown.current++ < 2 ? 'full' : 'brief'));
      if (initial.length) {
        setWindows(initial);
        initial.forEach(removeAfter);
      }
      return;
    }

    if (fresh.length) {
      // Cap concurrent windows so a burst doesn't stack twenty at once.
      setWindows((w) => [...w, ...fresh].slice(-3));
      fresh.forEach(removeAfter);
    }
  }, [ledger, target]);

  return (
    <section className="relative mb-4 overflow-hidden rounded-xl border border-navy-900/40 bg-[radial-gradient(120%_120%_at_50%_-10%,#2a2f6e_0%,#1b1e49_45%,#12142f_100%)] shadow-inner">
      <style>{THEATRE_KEYFRAMES}</style>
      {/* soft glow behind the workers for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-8 mx-auto h-40 w-2/3 rounded-full bg-info/10 blur-3xl" />
      <div className="relative flex items-center gap-2 px-4 py-2.5 text-white/80">
        <Cog className="ps-gear size-4 text-info" style={{ animation: 'psGear 3s linear infinite' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          ProofSync signing in &amp; filling the client&rsquo;s system
        </span>
        <span className="ml-auto hidden text-[10px] text-white/40 sm:inline">
          the way a person would — where there&rsquo;s no API
        </span>
      </div>

      <div className="relative h-[290px] px-3 pb-3">
        {windows.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-white/30">
            waiting for the next completed job&hellip;
          </div>
        )}
        {windows.map((win) => (
          <BrowserWindow key={win.id} win={win} />
        ))}
      </div>
    </section>
  );
}

/** Per-worker accent so the three cards read as distinct and the stage has depth. */
const THEATRE_ACCENTS = [
  { bar: 'from-teal-400 to-emerald-500', badge: 'bg-emerald-600', glow: 'shadow-emerald-500/30', dt: 'text-emerald-600/80' },
  { bar: 'from-sky-400 to-indigo-500', badge: 'bg-indigo-600', glow: 'shadow-indigo-500/30', dt: 'text-indigo-600/80' },
  { bar: 'from-fuchsia-400 to-violet-500', badge: 'bg-violet-600', glow: 'shadow-violet-500/30', dt: 'text-violet-600/80' },
];

/** One pop-open browser window: a worker filling the client's form, field by field. */
function BrowserWindow({ win }: { win: TheatreWindow }) {
  const worker = `ProofSync Worker ${String(win.slot + 1).padStart(2, '0')}`;
  const accent = THEATRE_ACCENTS[win.slot % THEATRE_ACCENTS.length]!;
  const gap = win.detail === 'brief' ? 0.16 : 0.22;
  const rowDelay = (i: number) => 0.4 + i * gap;
  const savedDelay = 0.4 + win.fields.length * gap + 0.12;

  return (
    <div
      className={cn(
        'ps-win absolute w-[31%] min-w-[248px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl',
        accent.glow,
      )}
      style={{ left: THEATRE_SLOTS[win.slot], top: `${10 + win.slot * 10}px`, animationDuration: `${win.lifeMs / 1000}s` }}
    >
      {/* accent stripe + browser chrome + the named worker */}
      <div className={cn('h-1 w-full bg-gradient-to-r', accent.bar)} />
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-1 flex-1 truncate rounded bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">
          concerto&thinsp;·&thinsp;{win.reference ?? 'work order'}
        </span>
        <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold text-white', accent.badge)}>
          {worker}
        </span>
      </div>

      {/* the client's form being filled in, field by field, like manual re-keying */}
      <div className="p-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Contractor update</p>
        {win.kind === 'ok' ? (
          <>
            <dl className="space-y-1.5">
              {win.fields.length === 0 && (
                <div className="ps-row text-[11px] text-slate-500" style={{ animationDelay: '0.4s' }}>
                  Entering completion details&hellip;
                </div>
              )}
              {win.fields.map((f, i) => (
                <div key={f.label} className="ps-row" style={{ animationDelay: `${rowDelay(i)}s` }}>
                  <dt className={cn('text-[9px] font-medium uppercase tracking-wide', accent.dt)}>{f.label}</dt>
                  <dd className="truncate text-[11px] font-medium text-slate-700">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div
              className="ps-row mt-2.5 flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
              style={{ animationDelay: `${savedDelay}s` }}
            >
              <CheckCircle2 className="size-3.5" />
              Saved to Concerto
            </div>
          </>
        ) : (
          <div
            className="ps-row flex items-start gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200"
            style={{ animationDelay: '0.5s' }}
          >
            <FileWarning className="mt-0.5 size-3.5 shrink-0" />
            {win.reference
              ? `No record matches ${win.reference} — flagged for a person`
              : 'Missing client reference — flagged for a person'}
          </div>
        )}
      </div>
    </div>
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
  act,
}: {
  state: DemoState;
  busy: boolean;
  onReset: () => void;
  onForce: () => void;
  act: 'human' | 'machine';
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
            <span
              className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                act === 'human' ? 'bg-info-soft text-info-text' : 'bg-navy-900 text-white',
              )}
            >
              {act === 'human' ? 'Act 1 · one job' : 'Act 2 · full floor'}
            </span>
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

/**
 * Eases a displayed number toward a target so counters visibly spin up when the
 * real figure jumps, instead of snapping. Purely presentational — the target is
 * always the real value.
 */
function useCountUp(target: number, durationMs = 900) {
  const [display, setDisplay] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let t0: number | null = null;
    const step = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = target;
    };
  }, [target, durationMs]);

  return display;
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
  const A = {
    source: { head: 'from-slate-800 to-navy-900', ring: 'ring-navy-800/30' },
    engine: { head: 'from-indigo-600 to-blue-700', ring: 'ring-indigo-500/30' },
    target: { head: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-500/30' },
  }[accent];

  return (
    <section className={cn('flex flex-col overflow-hidden rounded-xl bg-card shadow-lg ring-1', A.ring)}>
      {/* bold coloured header so each system reads at a glance and the page has depth */}
      <div className={cn('bg-gradient-to-br px-4 py-3 text-white', A.head)}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          <span className="text-[11px] font-medium text-white/70">{subtitle}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70">
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
            <a
              href={systemUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-white/90 underline-offset-2 hover:underline"
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
  activeRefs,
}: {
  rows: TargetRow[];
  session: { username: string } | null;
  db: string;
  systemUrl: string;
  transport: DemoState['transport'];
  activeRefs: Set<string>;
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
      {rows.map((row) => {
        const isActive = activeRefs.has(row.reference);
        return (
        <div
          key={row.reference}
          className={cn(
            'px-4 py-3 transition-colors duration-700',
            changed.has(row.reference) && 'bg-success-soft',
            isActive &&
              'bg-teal-50 shadow-[inset_3px_0_0_0_rgb(20_184_166)] ring-1 ring-inset ring-teal-400/60',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-navy-800">
              {isActive && (
                <span
                  className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500"
                  aria-hidden
                />
              )}
              {row.reference}
            </span>
            <Badge tone={isActive ? 'info' : (TARGET_TONE[row.status] ?? 'neutral')} dot>
              {isActive ? 'writing now' : row.status}
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
        );
      })}
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
