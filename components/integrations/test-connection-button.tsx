'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlugZap, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TestConnectionButton({ provider }: { provider: 'joblogic' | 'concerto' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/test`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setResult({ ok: json.data.ok, message: json.data.message, latencyMs: json.data.latencyMs });
      } else {
        setResult({ ok: false, message: json.error ?? 'Connection test failed.' });
      }
      router.refresh();
    } catch {
      setResult({ ok: false, message: 'Could not reach the integration service.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={test} disabled={busy} className="w-full">
        {busy ? <Loader2 className="animate-spin" /> : <PlugZap />}
        Test connection
      </Button>
      {result && (
        <div
          className={`flex items-start gap-2 rounded-md p-2.5 text-xs ${
            result.ok ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text'
          }`}
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 size-3.5" /> : <TriangleAlert className="mt-0.5 size-3.5" />}
          <span>
            {result.message}
            {result.latencyMs != null && ` (${result.latencyMs}ms)`}
          </span>
        </div>
      )}
    </div>
  );
}
