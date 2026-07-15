import { cn, formatTime } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  stage: string;
  level: string;
  message: string;
  createdAt: string | Date;
}

const LEVEL_DOT: Record<string, string> = {
  INFO: 'bg-info',
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-danger',
};

export function SyncTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-card',
              LEVEL_DOT[e.level] ?? 'bg-muted-foreground',
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-3">
            <time className="font-mono text-xs text-muted-foreground">{formatTime(e.createdAt)}</time>
            <p className={cn('text-sm', e.level === 'ERROR' ? 'text-danger-text' : e.level === 'WARNING' ? 'text-warning-text' : 'text-navy-800')}>
              {e.message}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
