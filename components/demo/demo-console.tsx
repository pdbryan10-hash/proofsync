'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Paperclip,
  Rocket,
  RotateCcw,
  Search,
  Table2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDuration, formatTime, timeAgo } from '@/lib/utils';
import type {
  DemoState,
  ExceptionItem,
  LedgerRow,
  SourceRow,
  SpotlightData,
  TargetRow,
} from '@/lib/demo/state';
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
  const { state, error, busy, activity, reset, forceTick, resolve, replay, runLogin, runMachineBatch } =
    useDemoState();
  // Work orders a worker is filling right now (from the theatre), so the Concerto
  // panel can highlight the SAME job the card is processing.
  const [activeRefs, setActiveRefs] = useState<Set<string>>(new Set());
  // The exception a coordinator is currently resolving (drives the modal).
  const [resolving, setResolving] = useState<ExceptionItem | null>(null);

  // Two acts. Act 1 follows ONE real job end to end at human speed, so a viewer
  // understands exactly what happens. Act 2 reveals the same thing running flat
  // out across the whole floor — the "oh, it's doing that to all of them" moment.
  const [act, setAct] = useState<'human' | 'machine'>('human');
  const [finale, setFinale] = useState<{
    jobs: number;
    fields: number;
    certs: number;
    minutes: number;
    exceptions: number;
    avgSyncMs: number;
    totalSyncMs: number;
  } | null>(null);
  const finaleFired = useRef(false);
  // Guards the Act 2 finale: true only once the re-queued batch has been seen in
  // flight, so the finale can't fire on the previous run's leftover "done" state.
  const machineSawPending = useRef(false);
  const [preparing, setPreparing] = useState(false);
  // True while the on-demand Act 2 batch run is in flight (the "Run the sync" button).
  const [syncing, setSyncing] = useState(false);

  // The real-browser login that opens each act. `login` drives the embedded
  // live-view curtain; the ref guards it to ONE sign-in per act, so it doesn't
  // re-fire on re-runs or re-renders.
  const [login, setLogin] = useState<{ act: 'human' | 'machine'; done: boolean } | null>(null);
  const loginFired = useRef<{ human: boolean; machine: boolean }>({ human: false, machine: false });

  // Show the sign-in curtain, run the real login, then hand off. Only the FIRST
  // time an act is opened — after that the session is established and re-running
  // the act shouldn't sign in again.
  const runActLogin = useCallback(
    async (act: 'human' | 'machine') => {
      if (loginFired.current[act] || !state?.remoteBrowserAvailable) return;
      loginFired.current[act] = true;
      setLogin({ act, done: false });
      // Never let a slow or failed browser wedge the demo: cap the whole sign-in.
      // Whichever comes first — the login finishing or the cap — the curtain lifts.
      const capped = new Promise((r) => setTimeout(r, 22_000));
      await Promise.race([runLogin(), capped]);
      setLogin((l) => (l ? { ...l, done: true } : l));
      // Hold on "Signed in" for a beat, then lift the curtain.
      await new Promise((r) => setTimeout(r, 700));
      setLogin(null);
    },
    [runLogin, state?.remoteBrowserAvailable],
  );

  // Auto-fire the "what just happened" card once the batch finishes in Act 2, so
  // the close lands without anyone reaching for the Freeze button. Re-arms when a
  // new run starts (awaiting climbs back up).
  useEffect(() => {
    // While preparing (rewind in flight) the panels still show the batch that
    // finished behind Act 1 — don't read that as "done" and fire the finale
    // instantly. Wait until the rewind has cleared and the live run completes.
    if (!state || act !== 'machine' || preparing) return;

    // A fresh run must actually be seen in flight before we can call it "done".
    // Otherwise, entering Act 2 while the PREVIOUS run's finished state is still on
    // screen (awaiting 0, records landed) fires the finale instantly — the "blur
    // straight to the complete box" bug. Only once we've watched awaiting climb
    // above zero (the re-queued batch) does a return to zero mean THIS run finished.
    if (state.stats.awaitingSync > 0) {
      machineSawPending.current = true;
      finaleFired.current = false;
      return;
    }
    const landed = state.stats.synced + state.stats.partial;
    if (!machineSawPending.current || landed === 0) return;
    if (finaleFired.current || finale) return;
    finaleFired.current = true;
    // Snapshot the completed figures and schedule WITHOUT a cleanup: the 1s poll
    // re-runs this effect, and a cleanup would clearTimeout the pending fire every
    // time (1s < 1.4s), so it never landed. finaleFired guards against duplicates.
    const snapshot = {
      jobs: state.stats.synced + state.stats.partial,
      fields: state.stats.fieldsWritten,
      certs: state.stats.certificatesUploaded,
      minutes: state.stats.adminMinutesSaved,
      exceptions: state.exceptions.length,
      avgSyncMs: state.stats.avgSyncMs,
      totalSyncMs: state.stats.totalSyncMs,
    };
    setTimeout(() => setFinale(snapshot), 1400);
  }, [state, act, finale, preparing]);

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

  // Enter Act 2 INSTANTLY and rewind in the background. A "rewinding" cover sits
  // over the floor until the batch is cleared, so there's no wait on the click and
  // no flash of the fully-synced state that quietly finished behind Act 1.
  const enterMachine = async () => {
    // Act 2 opens with one real sign-in (embedded), then sits EMPTY and READY:
    // the batch is re-queued PENDING and Concerto is empty, waiting for the
    // presenter to press "Run the sync" — so the (very fast) run fires on cue,
    // not the instant the act opens.
    await runActLogin('machine');
    finaleFired.current = false;
    machineSawPending.current = false;
    setPreparing(true);
    setAct('machine');
    await replay();
    setPreparing(false);
  };

  // Fire the batch on demand — the "Run the sync" button. Re-arms the finale and
  // drives the re-queued batch to completion (a couple of seconds on M10).
  const runBatch = async () => {
    setSyncing(true);
    finaleFired.current = false;
    machineSawPending.current = false;
    try {
      await runMachineBatch();
    } finally {
      setSyncing(false);
    }
  };

  // The applause screen states the batch result — all real, straight from state.
  const freeze = () =>
    setFinale({
      jobs: state.stats.synced + state.stats.partial,
      fields: state.stats.fieldsWritten,
      certs: state.stats.certificatesUploaded,
      minutes: state.stats.adminMinutesSaved,
      exceptions: state.exceptions.length,
      avgSyncMs: state.stats.avgSyncMs,
      totalSyncMs: state.stats.totalSyncMs,
    });

  return (
    <div className="min-h-screen bg-muted/40">
      <ConsoleHeader
        state={state}
        busy={busy}
        onReset={reset}
        onForce={forceTick}
        act={act}
        onSelectAct={(target) => {
          if (target === act) return;
          if (target === 'machine') void enterMachine();
          else setAct('human');
        }}
      />

      <div className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6">
        <CrossSystemSearch />
        {act === 'human' ? (
          <SpotlightStage
            spotlight={state.spotlight}
            seeded={state.seeded}
            onScaleUp={enterMachine}
            onStart={() => runActLogin('human')}
          />
        ) : (
          <MachineFloor
            state={state}
            activity={activity}
            activeRefs={activeRefs}
            onActive={setActiveRefs}
            busy={busy}
            preparing={preparing}
            syncing={syncing}
            onRun={runBatch}
            onReplay={replay}
            onBack={() => setAct('human')}
            onFreeze={freeze}
            onFix={setResolving}
          />
        )}

        {/* The "what this does / doesn't prove" note is only shown in the local
            browser-drive mode, where that distinction matters to whoever is
            running it. */}
        {state.transport === 'browser' && <HonestyNote transport={state.transport} />}
      </div>

      {login && (
        <LiveLoginCurtain
          act={login.act}
          done={login.done}
          joblogicUrl={state.browserProof?.joblogicUrl ?? null}
          concertoUrl={state.browserProof?.concertoUrl ?? null}
        />
      )}
      {finale && <FinaleCard data={finale} onClose={() => setFinale(null)} />}
      {resolving && (
        <ResolveModal
          item={resolving}
          onClose={() => setResolving(null)}
          onSubmit={(value) => resolve(resolving.reference, value)}
        />
      )}
    </div>
  );
}

// --- Cross-system search -----------------------------------------------------

interface SearchHit {
  system: 'Joblogic' | 'Concerto';
  kind: 'job' | 'work order' | 'file';
  title: string;
  subtitle: string;
  reference: string;
}

/**
 * One box that searches BOTH systems (and finds files in either). The point it
 * makes: ProofSync is signed into both, so from here you can find any record or
 * document without logging into each system separately.
 */
function CrossSystemSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/demo/search?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
        const body = await res.json();
        if (body?.ok) setHits(body.data.hits as SearchHit[]);
      } catch {
        /* ignore — search is best-effort */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const showPanel = open && q.trim().length >= 2;

  return (
    <div className="relative my-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-info/30">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search either system — a job, a work order, a certificate…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="size-4" />
          </button>
        )}
        <span className="ml-1 hidden shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          connected to both systems
        </span>
      </div>

      {showPanel && (
        <div className="absolute z-20 mt-1.5 max-h-[22rem] w-full overflow-auto rounded-xl border border-border bg-card shadow-xl">
          {hits.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Nothing matches &ldquo;{q.trim()}&rdquo; in either system.
            </div>
          )}
          <ul className="divide-y divide-border">
            {hits.map((h, i) => (
              <li key={`${h.system}-${h.reference}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                    h.kind === 'file'
                      ? 'bg-muted text-muted-foreground'
                      : h.system === 'Joblogic'
                        ? 'bg-slate-700 text-white'
                        : 'bg-emerald-600 text-white',
                  )}
                >
                  {h.kind === 'file' ? <Paperclip className="size-3.5" /> : <Database className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{h.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Badge tone={h.system === 'Joblogic' ? 'neutral' : 'success'}>{h.system}</Badge>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{h.kind}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Act 1: the spotlight ----------------------------------------------------

const SPOT_NODES = [
  { icon: Database, label: 'Joblogic', sub: 'job completed' },
  { icon: Cog, label: 'ProofSync', sub: 'reads & matches' },
  { icon: Chrome, label: 'Concerto', sub: 'fills the form' },
  { icon: CheckCircle2, label: 'Verified', sub: 'read back' },
];

/**
 * Act 1. ONE job walked across the four stops slowly enough that a stranger
 * understands exactly what ProofSync does. Built entirely from Joblogic source
 * data (state.spotlight), so it is available the instant the batch is seeded and
 * never waits on a sync — it cannot hang on "reading…". The pacing is
 * choreographed; every value shown is real.
 */
function SpotlightStage({
  spotlight,
  seeded,
  onScaleUp,
  onStart,
}: {
  spotlight: SpotlightData | null;
  seeded: boolean;
  onScaleUp: () => void;
  /** Runs once, before the first play — the real sign-in that opens Act 1. */
  onStart?: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [stage, setStage] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedOnce = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Fired by the presenter — deliberately slow, so every step is readable. The
  // very first play signs into the live systems first (onStart), then runs.
  const run = async () => {
    if (!spotlight) return;
    if (onStart && !startedOnce.current) {
      startedOnce.current = true;
      await onStart();
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('running');
    setStage(0);
    const fields = spotlight.fields.length;
    const durs = [2600, 2900, Math.max(3800, 1400 + fields * 480), 2700];
    let acc = 0;
    durs.forEach((d, i) => {
      acc += d;
      timers.current.push(setTimeout(() => setStage(i + 1), acc));
    });
    timers.current.push(setTimeout(() => setPhase('done'), acc + 500));
  };

  const stop = Math.min(stage, 3);
  const progress = (Math.min(stage, 3) / 3) * 100;

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

      {!spotlight ? (
        <div className="relative mt-8 flex h-56 flex-col items-center justify-center gap-3 text-white/50">
          {seeded ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Preparing the batch…</span>
            </>
          ) : (
            <span className="max-w-sm text-center text-sm">
              Both systems are empty. Press <strong className="text-white/80">Start over</strong> in
              the header to lay down a fresh set of jobs.
            </span>
          )}
        </div>
      ) : (
        <>
          <SpotRail stage={stage} progress={progress} />

          {/* The focus card — what is happening at the current stop, in detail. */}
          <div className="relative mx-auto mt-7 max-w-2xl">
            <SpotlightFocus spot={spotlight} stop={stop} />
          </div>

          {phase === 'idle' && (
            <div className="relative mx-auto mt-7 max-w-2xl text-center">
              <p className="text-sm text-white/70">
                One completed job is sitting in Joblogic, waiting to cross. Dispatch a worker and
                watch ProofSync do it — step by step.
              </p>
              <button
                type="button"
                onClick={run}
                className="group mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:from-emerald-400 hover:to-teal-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40"
              >
                <Rocket className="size-5 transition-transform group-hover:scale-110" />
                Run this sync
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="relative mx-auto mt-7 flex max-w-2xl items-center justify-center gap-2 text-sm text-white/50">
              <Loader2 className="size-4 animate-spin" />
              Working — signing in and filling the client&rsquo;s system…
            </div>
          )}

          {phase === 'done' && (
            <div className="relative mx-auto mt-7 max-w-2xl text-center">
              <p className="text-sm text-white/70">
                That was <strong className="text-white">one</strong> job — work a person never had to
                do. Now imagine it never stopping.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onScaleUp}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:from-indigo-400 hover:to-blue-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-info/40"
                >
                  <Zap className="size-5 transition-transform group-hover:scale-110" />
                  Now watch it at machine speed
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={run}
                  className="text-xs font-medium text-white/60 underline-offset-2 hover:text-white hover:underline"
                >
                  run it again
                </button>
              </div>
            </div>
          )}
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

/** The morphing detail card under the Act 1 rail — all from source data. */
function SpotlightFocus({ spot, stop }: { spot: SpotlightData; stop: number }) {
  if (stop === 0) {
    return (
      <FocusCard
        chip="Joblogic"
        chipTone="slate"
        title={spot.jobNumber}
        badge={<Badge tone="success" dot>Completed on site</Badge>}
      >
        <p className="text-sm font-medium text-foreground">{spot.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Fact label="Site" value={spot.site} />
          <Fact label="Engineer" value={spot.engineer ?? '—'} />
          <Fact label="Completed" value={spot.completedAt ? timeAgo(spot.completedAt) : 'just now'} />
          <Fact label="Paperwork" value={`${spot.documentCount} document(s) attached`} />
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
      <FocusCard chip="ProofSync" chipTone="indigo" title="Reads Joblogic — and finds the match">
        <ul className="mt-3 space-y-2 text-sm">
          <Step done>Read the completed job</Step>
          <Step done>
            Reference <span className="font-mono text-xs">{spot.reference}</span> matched to a work
            order
          </Step>
          <Step done>Client rules loaded — costs withheld by policy</Step>
          <Step>Mapping {spot.fields.length} field(s) into Concerto&rsquo;s form…</Step>
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
        title={`Fills ${spot.reference} in Concerto`}
        badge={<Badge tone="info" dot>typing it in</Badge>}
      >
        <dl className="mt-3 space-y-1.5">
          {spot.fields.map((f, i) => (
            <div
              key={f.label}
              className="ps-row flex items-baseline justify-between gap-3 rounded-md bg-success-soft/50 px-2.5 py-1.5"
              style={{ animationDelay: `${1.1 + i * 0.28}s` }}
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-success-text">
                {f.label}
              </dt>
              <dd className="truncate text-right text-xs font-medium text-foreground">{f.value}</dd>
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
            {spot.fields.length} field(s) written and read back to confirm
            {spot.documentCount > 0 ? `, ${spot.documentCount} document(s) attached` : ''}.
          </p>
          <p className="text-xs text-muted-foreground">0 minutes of re-keying.</p>
        </div>
      </div>
    </FocusCard>
  );
}

/** A mini browser signing in to a system — the "logs in like a person" proof. */
function MiniSignIn({ system, url, username }: { system: string; url: string; username: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-1 flex-1 truncate rounded bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">
          {url}
        </span>
        <Lock className="size-3 shrink-0 text-slate-400" />
      </div>
      <div className="space-y-2 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          {system} · sign in
        </p>
        <div className="ps-row" style={{ animationDelay: '0.2s' }}>
          <p className="text-[8px] font-medium uppercase tracking-wide text-slate-400">Email</p>
          <p className="truncate rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700">
            {username}
          </p>
        </div>
        <div className="ps-row" style={{ animationDelay: '0.45s' }}>
          <p className="text-[8px] font-medium uppercase tracking-wide text-slate-400">Password</p>
          <p className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] tracking-widest text-slate-400">
            ••••••••••••
          </p>
        </div>
        <div
          className="ps-row flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
          style={{ animationDelay: '0.85s' }}
        >
          <CheckCircle2 className="size-3.5" />
          Signed in
        </div>
      </div>
    </div>
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
  preparing,
  syncing,
  onRun,
  onReplay,
  onBack,
  onFreeze,
  onFix,
}: {
  state: DemoState;
  activity: ActivityLine[];
  activeRefs: Set<string>;
  onActive: (refs: Set<string>) => void;
  busy: boolean;
  preparing: boolean;
  syncing: boolean;
  onRun: () => void;
  onReplay: () => void;
  onBack: () => void;
  onFreeze: () => void;
  onFix: (item: ExceptionItem) => void;
}) {
  const awaiting = state.stats.awaitingSync;
  const landed = state.stats.synced + state.stats.partial;
  return (
    <div className="relative">
      {preparing && (
        <div className="absolute inset-0 z-30 -mx-4 flex flex-col items-center justify-center gap-3 rounded-xl bg-[#f4f5f7]">
          <div className="flex items-center gap-2.5 rounded-full border border-info-soft bg-white px-5 py-2.5 shadow-sm">
            <Loader2 className="size-4 animate-spin text-info" />
            <span className="text-sm font-medium text-navy-800">Setting the batch back to the start…</span>
          </div>
          <p className="text-xs text-muted-foreground">A moment, then watch it run</p>
        </div>
      )}
      <MachineHeader
        busy={busy}
        syncing={syncing}
        landed={landed}
        awaiting={awaiting}
        onRun={onRun}
        onReplay={onReplay}
        onBack={onBack}
        onFreeze={onFreeze}
      />
      <KpiBar stats={state.stats} exceptionCount={state.exceptions.length} />
      <ExceptionsQueue exceptions={state.exceptions} onFix={onFix} />
      <ActivityFeed activity={activity} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SourcePanel
          rows={state.source}
          session={state.sessions.joblogic}
          db={state.databases.source}
          systemUrl={state.systemUrls.source}
          transport={state.transport}
        />
        <LedgerPanel rows={state.ledger} db={state.databases.ledger} activeRefs={activeRefs} />
        <TargetPanel
          rows={state.target}
          session={state.sessions.concerto}
          db={state.databases.target}
          systemUrl={state.systemUrls.target}
          transport={state.transport}
          activeRefs={activeRefs}
        />
      </div>
    </div>
  );
}

function MachineHeader({
  busy,
  syncing,
  landed,
  awaiting,
  onRun,
  onReplay,
  onBack,
  onFreeze,
}: {
  busy: boolean;
  syncing: boolean;
  landed: number;
  awaiting: number;
  onRun: () => void;
  onReplay: () => void;
  onBack: () => void;
  onFreeze: () => void;
}) {
  // Empty and ready: nothing synced yet, waiting for the presenter to fire it.
  const ready = landed === 0 && !syncing;
  const done = landed > 0 && awaiting === 0 && !syncing;

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
          <p className="mt-2 text-xs text-white/50">
            {syncing
              ? 'Syncing every job into Concerto…'
              : ready
                ? 'Signed in and ready — press Run to sync the whole batch at once.'
                : done
                  ? 'Done. Press Freeze for the result, or Reset to run it again.'
                  : 'Batch loaded.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ready ? (
            <button
              type="button"
              onClick={onRun}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40"
            >
              <Zap className="size-4" />
              Run the sync
            </button>
          ) : syncing ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/80 px-5 py-2.5 text-sm font-bold text-white">
              <Loader2 className="size-4 animate-spin" />
              Syncing…
            </span>
          ) : (
            <button
              type="button"
              onClick={onFreeze}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-navy-900 shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              Freeze — the result
            </button>
          )}
          <Button size="sm" variant="outline" onClick={onReplay} disabled={busy || syncing}>
            {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Reset
          </Button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20"
          >
            <Table2 className="size-4" />
            Explore the data
          </a>
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
function KpiBar({ stats, exceptionCount }: { stats: DemoState['stats']; exceptionCount: number }) {
  const synced = useCountUp(stats.synced);
  const minutes = useCountUp(stats.adminMinutesSaved);
  const complete = useCountUp(stats.sourceComplete);
  // The honest "needs a person" figure is the count of unresolved blocks — it
  // only moves when someone actually clears one.
  const flagged = useCountUp(exceptionCount);

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

// --- Exceptions: the human-in-the-loop queue ---------------------------------

/** The jobs Concerto refused, waiting for a person. Empty = nothing to do. */
function ExceptionsQueue({
  exceptions,
  onFix,
}: {
  exceptions: ExceptionItem[];
  onFix: (item: ExceptionItem) => void;
}) {
  if (exceptions.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-success-soft bg-success-soft/50 px-4 py-3 text-sm text-success-text">
        <CheckCircle2 className="size-4" />
        Nothing waiting for a person — every job Concerto could accept is in.
      </div>
    );
  }
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-warning-soft bg-card">
      <div className="flex items-center gap-2 border-b border-warning-soft bg-warning-soft/60 px-4 py-2.5">
        <FileWarning className="size-4 text-warning-text" />
        <span className="text-xs font-semibold uppercase tracking-wide text-warning-text">
          Waiting for a person — {exceptions.length}
        </span>
        <span className="ml-auto text-[11px] text-warning-text/80">
          ProofSync refused to guess. Fix each one and it crosses.
        </span>
      </div>
      <ul className="divide-y divide-border">
        {exceptions.map((e) => (
          <li key={e.reference} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-navy-800">{e.jobNumber}</span>
                <span className="text-xs text-muted-foreground">→ {e.reference}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-foreground">{e.summary}</p>
              <p className="mt-0.5 text-[11px] text-warning-text">{e.message}</p>
            </div>
            <Button size="sm" onClick={() => onFix(e)}>
              Fix &amp; resubmit
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The dialog a coordinator uses to supply/correct the field and resubmit. */
function ResolveModal({
  item,
  onClose,
  onSubmit,
}: {
  item: ExceptionItem;
  onClose: () => void;
  onSubmit: (value: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [value, setValue] = useState(item.kind === 'INVALID_VALUE' ? (item.badValue ?? '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value.trim()) {
      setError('Please enter a value.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSubmit(value.trim());
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Could not resolve that job.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border bg-warning-soft/50 px-5 py-3">
          <FileWarning className="size-4 text-warning-text" />
          <span className="text-sm font-semibold text-warning-text">Concerto refused this save</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-navy-800">{item.jobNumber}</span>
            <span>→ {item.reference}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{item.summary}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.propertyName}</p>

          <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
            {item.message}
          </p>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </label>
          {item.kind === 'INVALID_VALUE' ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30"
              placeholder="Re-enter clean text…"
            />
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30"
              placeholder={`Enter the ${item.label.toLowerCase()}…`}
            />
          )}

          {error && <p className="mt-2 text-xs text-danger-text">{error}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Resubmit to Concerto
            </Button>
          </div>
        </div>
      </div>
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
  data: {
    jobs: number;
    fields: number;
    certs: number;
    minutes: number;
    exceptions: number;
    avgSyncMs: number;
    totalSyncMs: number;
  };
  onClose: () => void;
}) {
  const rows = [
    { to: data.jobs, label: 'jobs completed into Concerto' },
    { to: data.fields, label: 'fields updated' },
    { to: data.certs, label: 'documents uploaded' },
  ];
  const avgSec = (data.avgSyncMs / 1000).toFixed(1);
  const totalSec = (data.totalSyncMs / 1000).toFixed(1);
  // Extrapolate at a typical mid-market volume so the tiny demo figure lands as a
  // real annual saving. Uses the same minutes-per-job basis as the run itself.
  const perJobMin = data.jobs > 0 ? data.minutes / data.jobs : 10;
  const annualHours = Math.round((500 * 52 * perJobMin) / 60).toLocaleString();
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
          While you watched
        </p>

        <div className="mt-6 grid grid-cols-3 gap-x-5 gap-y-5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="text-3xl font-black text-white sm:text-4xl">
                <BigCount to={r.to} />
              </div>
              <div className="mt-1 text-[11px] leading-snug text-white/60 sm:text-xs">{r.label}</div>
            </div>
          ))}
        </div>

        {/* The number that matters — time back, in hours, extrapolated to a year. */}
        <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4">
          <div className="text-4xl font-black text-emerald-300">
            <BigCount to={Math.round(data.minutes / 60)} suffix="" />
            <span className="text-2xl"> hrs</span>
          </div>
          <div className="mt-0.5 text-sm text-white/75">given back to your team in this run</div>
          <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/60">
            At 500 completed jobs a week, that&apos;s <strong className="text-emerald-300">~{annualHours} hours a year</strong>.
          </p>
          <p className="mt-1.5 text-[11px] text-white/40">
            Basis: {Math.round(perJobMin)} min of duplicated admin per job — the same figure across the site.
          </p>
        </div>

        {/* Honest against the exception story: zero touch on the clean ones only. */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="text-2xl font-black text-white">0</div>
          <div className="text-sm text-white/70">
            minutes of admin on the {data.jobs} that synced clean
          </div>
          {data.exceptions > 0 && (
            <p className="mt-1 text-xs text-white/55">
              {data.exceptions} set aside for a person — the only one{data.exceptions === 1 ? '' : 's'} that
              needed you. That&apos;s the point, not a caveat.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-[11px] text-white/45">
          <span>avg {avgSec}s / job</span>
          <span>{totalSec}s total machine time</span>
        </div>

        <p className="mt-5 text-2xl">👏</p>
        <p className="mt-1 text-sm font-semibold text-white/85">Tomorrow it&apos;ll do the same thing again.</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.03]"
          >
            <Table2 className="size-4" />
            Show me the proof
          </a>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Keep watching
          </button>
        </div>
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
// Two BIG slots side by side: the browser is the thing people remember, so it's
// large and central — but two at a time still reads as "a fleet of workers".
const THEATRE_SLOTS = ['3%', '51%'];

interface TheatreStep {
  label: string;
  tone: 'ok' | 'fail' | 'gold';
}

interface TheatreWindow {
  id: number;
  workerNo: number;
  jobNumber: string;
  reference: string | null;
  kind: 'ok' | 'fail';
  steps: TheatreStep[];
  slot: number;
  stepMs: number;
  lifeMs: number;
}

const STEP_GAP_MS = 360;

/** Build the worker's step list — honest to the engine's real stages. */
function buildSteps(r: LedgerRow): TheatreStep[] {
  const ref = r.reference ?? 'the work order';
  const ok = r.status === 'SUCCESS' || r.status === 'PARTIAL';
  const fields = r.targetFields.length || r.fieldsUpdated;
  const docs = r.documentsTransferred;

  const steps: TheatreStep[] = [
    { label: 'Logging in to Concerto', tone: 'ok' },
    { label: `Finding ${ref}`, tone: 'ok' },
    { label: 'Reading the completed job', tone: 'ok' },
  ];
  if (!ok) {
    steps.push({ label: 'Concerto refused the save — set aside for a person', tone: 'fail' });
    return steps;
  }
  steps.push({ label: `Updating ${fields} field${fields === 1 ? '' : 's'}`, tone: 'ok' });
  if (docs > 0) steps.push({ label: `Uploading ${docs} document${docs === 1 ? '' : 's'}`, tone: 'ok' });
  steps.push({ label: 'Saving', tone: 'ok' });
  steps.push({ label: 'Verifying', tone: 'ok' });
  steps.push({ label: 'Complete', tone: 'gold' });
  return steps;
}

function BrowserTheatre({
  ledger,
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
  const workerIx = useRef(0);
  // Jobs waiting to be shown. Filling this from ledger transitions and RELEASING
  // it on a steady timer is what keeps the stage consistently populated: a burst
  // of jobs completing between two polls no longer flashes past or gets dropped —
  // each one is queued and paraded in turn.
  const queue = useRef<LedgerRow[]>([]);

  // Tell the other panels which jobs a worker is driving right now, so the SAME
  // record lights up across all three views as the worker moves through it.
  useEffect(() => {
    if (!onActive) return;
    onActive(new Set(windows.filter((w) => w.reference).map((w) => w.reference!)));
  }, [windows, onActive]);

  // Enqueue every job as it crosses the finish line (deduped via the seen map).
  useEffect(() => {
    const first = seen.current === null;
    const prev = seen.current ?? new Map<string, string>();
    const next = new Map<string, string>();
    const fresh: LedgerRow[] = [];
    for (const r of ledger) {
      next.set(r.id, r.status);
      if (TERMINAL.includes(r.status) && !TERMINAL.includes(prev.get(r.id) ?? '')) fresh.push(r);
    }
    seen.current = next;
    if (first) {
      queue.current.push(
        ...ledger.filter((r) => TERMINAL.includes(r.status)).slice(0, 8).reverse(),
      );
    } else if (fresh.length) {
      queue.current.push(...fresh);
    }
    if (queue.current.length > 14) queue.current = queue.current.slice(-14);
  }, [ledger]);

  // Release the parade at a steady pace — up to two workers on stage at once.
  useEffect(() => {
    const makeWin = (r: LedgerRow): TheatreWindow => {
      const steps = buildSteps(r);
      const ok = r.status === 'SUCCESS' || r.status === 'PARTIAL';
      return {
        id: winId.current++,
        workerNo: (workerIx.current++ % 5) + 1,
        jobNumber: r.jobNumber,
        reference: r.reference,
        kind: ok ? 'ok' : 'fail',
        steps,
        slot: slotIx.current++ % THEATRE_SLOTS.length,
        stepMs: STEP_GAP_MS,
        lifeMs: Math.round(700 + steps.length * STEP_GAP_MS + 1300),
      };
    };
    const id = setInterval(() => {
      if (queue.current.length === 0) return;
      setWindows((w) => {
        if (w.length >= 2) return w;
        const r = queue.current.shift();
        if (!r) return w;
        const win = makeWin(r);
        setTimeout(() => setWindows((x) => x.filter((y) => y.id !== win.id)), win.lifeMs + 200);
        return [...w, win];
      });
    }, 850);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative mb-4 overflow-hidden rounded-xl border border-navy-900/40 bg-[radial-gradient(120%_120%_at_50%_-10%,#2a2f6e_0%,#1b1e49_45%,#12142f_100%)] shadow-inner">
      <style>{THEATRE_KEYFRAMES}</style>
      <div className="pointer-events-none absolute inset-x-0 top-8 mx-auto h-48 w-2/3 rounded-full bg-info/10 blur-3xl" />
      <div className="relative flex items-center gap-2 px-4 py-2.5 text-white/80">
        <Cog className="ps-gear size-4 text-info" style={{ animation: 'psGear 3s linear infinite' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          ProofSync dispatches a worker for each completed job
        </span>
        <span className="ml-auto hidden text-[10px] text-white/40 sm:inline">
          it signs in and works the client&rsquo;s system itself — no API
        </span>
      </div>

      <div className="relative h-[360px] px-3 pb-3">
        {windows.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-white/30">
            workers standing by&hellip;
          </div>
        )}
        {windows.map((win) => (
          <BrowserWindow key={win.id} win={win} />
        ))}
      </div>
    </section>
  );
}

/** Per-worker accent so successive workers read as distinct. */
const THEATRE_ACCENTS = [
  { bar: 'from-teal-400 to-emerald-500', badge: 'bg-emerald-600', glow: 'shadow-emerald-500/40' },
  { bar: 'from-sky-400 to-indigo-500', badge: 'bg-indigo-600', glow: 'shadow-indigo-500/40' },
  { bar: 'from-fuchsia-400 to-violet-500', badge: 'bg-violet-600', glow: 'shadow-violet-500/40' },
  { bar: 'from-amber-400 to-orange-500', badge: 'bg-orange-600', glow: 'shadow-orange-500/40' },
  { bar: 'from-rose-400 to-pink-500', badge: 'bg-pink-600', glow: 'shadow-pink-500/40' },
];

/** One BIG dispatched worker: signs in and works the client's system, step by step. */
function BrowserWindow({ win }: { win: TheatreWindow }) {
  const accent = THEATRE_ACCENTS[(win.workerNo - 1) % THEATRE_ACCENTS.length]!;
  const worker = `Worker ${String(win.workerNo).padStart(2, '0')}`;
  const step = (i: number) => `${(700 + i * win.stepMs) / 1000}s`;

  return (
    <div
      className={cn(
        'ps-win absolute w-[46%] min-w-[340px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl',
        accent.glow,
      )}
      style={{ left: THEATRE_SLOTS[win.slot], top: '14px', animationDuration: `${win.lifeMs / 1000}s` }}
    >
      <div className={cn('h-1.5 w-full bg-gradient-to-r', accent.bar)} />

      {/* Dispatch line — "🚀 Worker 03 assigned · opening client system" */}
      <div className={cn('flex items-center gap-2 px-3.5 py-2 text-white', accent.badge)}>
        <Rocket className="size-4" />
        <span className="text-xs font-bold">{worker} assigned</span>
        <span className="ml-auto text-[10px] font-medium text-white/80">opening client system…</span>
      </div>

      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-1 flex-1 truncate rounded bg-white px-2.5 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
          concerto.client-fm.co.uk&thinsp;·&thinsp;{win.reference ?? 'work order'}
        </span>
      </div>

      {/* The real steps, ticking through one by one. */}
      <ul className="space-y-2.5 px-4 py-4">
        {win.steps.map((s, i) => (
          <li key={s.label} className="ps-row flex items-center gap-2.5" style={{ animationDelay: step(i) }}>
            {s.tone === 'fail' ? (
              <FileWarning className="size-4 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2
                className={cn('size-4 shrink-0', s.tone === 'gold' ? 'text-emerald-500' : 'text-emerald-400')}
              />
            )}
            <span
              className={cn(
                'text-[13px]',
                s.tone === 'fail' && 'font-medium text-amber-700',
                s.tone === 'gold' && 'font-bold text-emerald-700',
                s.tone === 'ok' && 'text-slate-600',
              )}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ul>
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
  onSelectAct,
}: {
  state: DemoState;
  busy: boolean;
  onReset: () => void;
  onForce: () => void;
  act: 'human' | 'machine';
  onSelectAct: (act: 'human' | 'machine') => void;
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
          <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => onSelectAct('human')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                act === 'human' ? 'bg-info-soft text-info-text shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              One job
            </button>
            <button
              type="button"
              onClick={() => onSelectAct('machine')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                act === 'machine' ? 'bg-navy-900 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Machine speed
            </button>
          </div>
        </div>

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
          <a
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-navy-800 px-3 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
          >
            <Table2 className="size-4" />
            Explore the data
          </a>
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
 * The sign-in curtain that opens each act.
 *
 * A real cloud browser (Browserbase) signs into both systems, embedded live in
 * this overlay, before the act's data movement runs. This is the credibility
 * beat: no API, no shortcut — a browser keying in credentials exactly as a person
 * would. Once the sign-in finishes, the curtain lifts and the fast Direct sync
 * takes over in the demo's own panels.
 */
function LiveLoginCurtain({
  act,
  done,
  joblogicUrl,
  concertoUrl,
}: {
  act: 'human' | 'machine';
  done: boolean;
  joblogicUrl: string | null;
  concertoUrl: string | null;
}) {
  const heading = act === 'human' ? 'Act 1 · one job' : 'Act 2 · full floor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-950 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <span className="rounded-full bg-info/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-info-soft">
            {heading}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              {done ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  Signed in to both systems
                </>
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin text-info-soft" />
                  Signing in to both systems at once…
                </>
              )}
            </p>
            <p className="truncate text-xs text-white/50">
              Two real browser tabs keying in side by side — Joblogic and Concerto. No API, no shortcut.
            </p>
          </div>
          <Chrome className="ml-auto size-4 shrink-0 text-white/40" />
        </div>

        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          <LoginPane label="Joblogic" sub="contractor's system" url={joblogicUrl} done={done} />
          <LoginPane label="Concerto" sub="client's system" url={concertoUrl} done={done} />
        </div>
      </div>
    </div>
  );
}

/** One system's live-view tab inside the sign-in curtain. */
function LoginPane({
  label,
  sub,
  url,
  done,
}: {
  label: string;
  sub: string;
  url: string | null;
  done: boolean;
}) {
  return (
    <div className="relative bg-navy-950">
      <div className="flex items-center gap-2 px-3 py-1.5 text-white/70">
        <Chrome className="size-3.5 text-white/40" />
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[10px] text-white/40">{sub}</span>
      </div>
      <div className="relative aspect-[4/3] w-full bg-black">
        {url ? (
          <iframe
            key={url}
            src={url}
            title={`${label} signing in`}
            className="absolute inset-0 size-full"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs">Opening {label}…</span>
          </div>
        )}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70">
            <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
              <CheckCircle2 className="size-3.5" />
              Signed in
            </div>
          </div>
        )}
      </div>
    </div>
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

          {row.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.attachments.map((a) => (
                <span
                  key={a.fileName}
                  title={a.fileName}
                  className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Paperclip className="size-2.5 shrink-0" />
                  <span className="truncate">{a.category}</span>
                </span>
              ))}
            </div>
          )}
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

function LedgerPanel({
  rows,
  db,
  activeRefs,
}: {
  rows: LedgerRow[];
  db: string;
  activeRefs?: Set<string>;
}) {
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
        const active = !!row.reference && !!activeRefs?.has(row.reference);
        return (
          <div
            key={row.id}
            className={cn(
              'px-4 py-3 transition-colors duration-700',
              changed.has(row.id) && 'bg-info-soft',
              active && 'bg-amber-50 shadow-[inset_3px_0_0_0_rgb(245_158_11)]',
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

            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Open this job in</span>
              <a
                href={`/systems/joblogic/enter?next=/systems/joblogic/jobs/${row.jobNumber}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-medium text-navy-800 transition-colors hover:bg-muted"
              >
                Joblogic <span aria-hidden>↗</span>
              </a>
              {row.reference && (
                <a
                  href={`/systems/concerto/enter?next=/systems/concerto/work-orders/${row.reference}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-medium text-emerald-700 transition-colors hover:bg-muted"
                >
                  Concerto <span aria-hidden>↗</span>
                </a>
              )}
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
        Each act opens with a real browser signing into both systems, the way a person would.
      </p>
    </div>
  );
}

function humanise(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}
