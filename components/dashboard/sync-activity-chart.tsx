import type { DailySyncPoint } from '@/lib/services/metrics';

const COLORS = {
  success: '#15803d',
  partial: '#b45309',
  exception: '#b91c1c',
};

/**
 * Lightweight, dependency-free stacked bar chart of daily sync activity.
 * Rendered as inline SVG so it stays crisp and adds no client JS.
 */
export function SyncActivityChart({ data }: { data: DailySyncPoint[] }) {
  const width = 720;
  const height = 220;
  const padX = 28;
  const padTop = 12;
  const padBottom = 28;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const totals = data.map((d) => d.success + d.partial + d.exception);
  const max = Math.max(10, ...totals);
  const barW = plotW / data.length;
  const innerW = Math.min(28, barW * 0.6);

  const yFor = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div className="scroll-x">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Sync activity over time">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padTop + plotH - t * plotH;
          return (
            <g key={t}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={8} y={y + 3} fontSize="9" fill="#94a3b8">
                {Math.round(t * max)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padX + i * barW + barW / 2;
          const x = cx - innerW / 2;
          const successH = (d.success / max) * plotH;
          const partialH = (d.partial / max) * plotH;
          const exceptionH = (d.exception / max) * plotH;
          const successY = yFor(d.success);
          const partialY = successY - partialH;
          const exceptionY = partialY - exceptionH;
          return (
            <g key={d.date}>
              <rect x={x} y={successY} width={innerW} height={successH} fill={COLORS.success} rx="2" />
              {d.partial > 0 && <rect x={x} y={partialY} width={innerW} height={partialH} fill={COLORS.partial} />}
              {d.exception > 0 && <rect x={x} y={exceptionY} width={innerW} height={exceptionH} fill={COLORS.exception} rx="2" />}
              <text x={cx} y={height - 10} fontSize="9" fill="#64748b" textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <Legend color={COLORS.success} label="Successful" />
        <Legend color={COLORS.partial} label="Partial" />
        <Legend color={COLORS.exception} label="Exceptions" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
