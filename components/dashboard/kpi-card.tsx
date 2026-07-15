import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'navy',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  tone?: 'navy' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClasses = {
    navy: 'bg-navy-50 text-navy-800',
    success: 'bg-success-soft text-success-text',
    warning: 'bg-warning-soft text-warning-text',
    danger: 'bg-danger-soft text-danger-text',
    info: 'bg-info-soft text-info-text',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-navy-800">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toneClasses)}>
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}
