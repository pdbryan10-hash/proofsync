'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PollNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function poll() {
    setBusy(true);
    setResult(null);
    try {
      // Widen the window for the manual demo run so seeded jobs are detected.
      const res = await fetch('/api/cron/poll-completions?sinceMinutes=10080', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const d = json.data;
        setResult(`Detected ${d.detected} completed job(s) · ${d.synced} synced · ${d.partial} partial · ${d.skipped} already done · ${d.exceptions} exception(s).`);
      } else {
        setResult(json.error ?? 'Poll failed.');
      }
      router.refresh();
    } catch {
      setResult('Could not reach the poller.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={poll} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Check for completed jobs now
      </Button>
      {result && (
        <div className="flex items-start gap-2 rounded-md bg-info-soft p-2.5 text-xs text-info-text">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          <span>{result}</span>
        </div>
      )}
    </div>
  );
}
