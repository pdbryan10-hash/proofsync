import { FlaskConical } from 'lucide-react';
import { getIntegrationMode } from '@/lib/config';

/** Discreet but visible DEMO / LIVE mode indicator (§22). */
export function ModeBadge() {
  const mode = getIntegrationMode();
  if (mode === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success-soft bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-text">
        <span className="size-1.5 rounded-full bg-success" />
        LIVE MODE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-soft bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-text">
      <FlaskConical className="size-3.5" />
      DEMO MODE
    </span>
  );
}
