'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RotateCw, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';

interface Props {
  exceptionId: string;
  jobId: string;
  type: string;
  status: string;
  concertoJobReference: string | null;
}

export function ExceptionActions({ exceptionId, jobId, type, status, concertoJobReference }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState(concertoJobReference ?? '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const needsReference = type === 'MISSING_CONCERTO_REFERENCE' || type === 'TARGET_JOB_NOT_FOUND';
  const terminal = status === 'RESOLVED' || status === 'CLOSED';

  async function submit(retry: boolean) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concertoJobReference: needsReference && reference ? reference.trim() : undefined,
          resolutionNotes: notes || undefined,
          retry,
        }),
      });
      const json = await res.json();
      const outcome = json.ok ? json.data : { ok: false, message: json.error ?? 'Request failed' };
      setResult({ ok: !!outcome.ok, message: outcome.message });
      router.refresh();
      if (outcome.ok) setTimeout(() => setOpen(false), 1400);
    } catch {
      setResult({ ok: false, message: 'Could not reach the resolver.' });
    } finally {
      setBusy(false);
    }
  }

  if (terminal) {
    return (
      <Link href={`/jobs/${jobId}`} className="text-xs font-medium text-info-text hover:underline">
        View job
      </Link>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {needsReference ? 'Fix & retry' : 'Review'}
        </Button>
        <Link href={`/jobs/${jobId}`} className="text-xs font-medium text-muted-foreground hover:text-navy-800">
          View
        </Link>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={needsReference ? 'Resolve & retry sync' : 'Resolve exception'}
        description={
          needsReference
            ? 'Supply the correct Concerto reference, then retry. The sync re-runs and closes this exception on success.'
            : 'Retry the sync, or mark this exception resolved after manual review.'
        }
      >
        <div className="space-y-4">
          {needsReference && (
            <div>
              <label className="text-sm font-medium text-navy-800">Concerto reference</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CON-284811"
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">Format: CON- followed by 4–8 digits.</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-navy-800">Resolution notes (optional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you check or change?" className="mt-1" />
          </div>

          {result && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                result.ok ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text'
              }`}
            >
              {result.ok ? <CheckCircle2 className="mt-0.5 size-4" /> : <TriangleAlert className="mt-0.5 size-4" />}
              {result.message}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => submit(false)} disabled={busy}>
              Mark resolved
            </Button>
            <Button variant="success" size="sm" onClick={() => submit(true)} disabled={busy || (needsReference && !reference)}>
              {busy ? <Loader2 className="animate-spin" /> : <RotateCw />}
              {needsReference ? 'Save & retry' : 'Retry sync'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
