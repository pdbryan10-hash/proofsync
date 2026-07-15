'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, CircleDashed, Zap, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STAGES = [
  'Validating Joblogic record',
  'Matching Concerto job',
  'Transforming completion data',
  'Updating Concerto',
  'Uploading documents',
  'Verifying target record',
  'Complete',
];

interface RunSummary {
  status: string;
  fieldsUpdated: number;
  documentsTransferred: number;
  durationMs: number | null;
}

export function SyncPanel({
  jobId,
  concertoReference,
  syncStatus,
  estimatedMinutesPerJob,
}: {
  jobId: string;
  concertoReference: string | null;
  syncStatus: string;
  estimatedMinutesPerJob: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [stage, setStage] = useState(0);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [message, setMessage] = useState<string>('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasReference = !!concertoReference;
  const alreadySynced = syncStatus === 'SYNCED';

  async function runSync() {
    setPhase('running');
    setStage(0);
    setSummary(null);
    setMessage('');

    timer.current = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 2)); // hold at "Verifying" until response
    }, 520);

    try {
      const res = await fetch(`/api/jobs/${jobId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'MANUAL' }),
      });
      const json = await res.json();
      if (timer.current) clearInterval(timer.current);

      if (!json.ok) {
        setPhase('error');
        setMessage(json.error ?? 'Sync failed.');
        setStage(STAGES.length - 1);
        router.refresh();
        return;
      }

      const result = json.data;
      if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
        setStage(STAGES.length - 1);
        // Pull the run for accurate counts.
        let runSummary: RunSummary = { status: result.status, fieldsUpdated: 0, documentsTransferred: 0, durationMs: null };
        if (result.syncRunId) {
          const runRes = await fetch(`/api/sync-runs/${result.syncRunId}`);
          const runJson = await runRes.json();
          if (runJson.ok) {
            runSummary = {
              status: result.status,
              fieldsUpdated: runJson.data.fieldsUpdated,
              documentsTransferred: runJson.data.documentsTransferred,
              durationMs: runJson.data.durationMs,
            };
          }
        }
        setSummary(runSummary);
        setPhase('done');
      } else {
        setPhase('error');
        setMessage(result.message ?? 'Sync raised an exception.');
        setStage(STAGES.length - 1);
      }
      router.refresh();
    } catch {
      if (timer.current) clearInterval(timer.current);
      setPhase('error');
      setMessage('Could not reach the sync service.');
    }
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {alreadySynced
            ? 'This job has already been synced. Running again will re-apply the current Joblogic values.'
            : hasReference
              ? 'Trigger a JOBLOGIC → CONCERTO sync for this job.'
              : 'This job has no Concerto reference — resolve the exception before syncing.'}
        </p>
        <Button variant="success" size="lg" onClick={runSync} disabled={!hasReference}>
          <Zap />
          Sync to Concerto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-1.5">
        {STAGES.map((label, i) => {
          const state = i < stage ? 'done' : i === stage ? (phase === 'running' ? 'active' : phase === 'error' && i === STAGES.length - 1 ? 'error' : 'done') : 'pending';
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className="flex size-5 items-center justify-center">
                {state === 'done' && <Check className="size-4 text-success" />}
                {state === 'active' && <Loader2 className="size-4 animate-spin text-info-text" />}
                {state === 'error' && <TriangleAlert className="size-4 text-danger" />}
                {state === 'pending' && <CircleDashed className="size-4 text-muted-foreground/40" />}
              </span>
              <span className={cn(state === 'pending' ? 'text-muted-foreground/50' : 'text-navy-800', state === 'active' && 'font-medium')}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {phase === 'done' && summary && (
        <div className="animate-fade-in rounded-lg border border-success-soft bg-success-soft/50 p-4">
          <div className="flex items-center gap-2 text-success-text">
            <CheckCircle2 className="size-5" />
            <p className="font-semibold">{summary.status === 'PARTIAL' ? 'Sync partially complete' : 'Sync complete'}</p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            <Stat label="Concerto job" value={concertoReference ?? '—'} mono />
            <Stat label="Fields updated" value={String(summary.fieldsUpdated)} />
            <Stat label="Documents" value={String(summary.documentsTransferred)} />
            <Stat label="Processing time" value={summary.durationMs ? `${(summary.durationMs / 1000).toFixed(1)}s` : '—'} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Estimated manual admin avoided: ~{estimatedMinutesPerJob} minutes. Open the Sync History tab for the full audit trail.
          </p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => { setPhase('idle'); }}>
              Done
            </Button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="animate-fade-in rounded-lg border border-warning-soft bg-warning-soft/50 p-4">
          <div className="flex items-center gap-2 text-warning-text">
            <TriangleAlert className="size-5" />
            <p className="font-semibold">Sync raised an exception</p>
          </div>
          <p className="mt-2 text-sm text-navy-800">{message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            The system never fails silently — this has been recorded on the Exceptions page with a full audit trail.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPhase('idle')}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold text-navy-800', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
