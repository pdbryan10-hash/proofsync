import { cn } from '@/lib/utils';

/**
 * SEE Services brand mark, recreated as resolution-independent SVG so it renders
 * crisply everywhere and needs no binary asset. The design echoes the official
 * logo: a six-blade colour "aperture" orbited by a slate swoosh, the navy "SEE"
 * wordmark, and the "Comply · Maintain · Sustain" strapline.
 *
 * To use the official raster/vector instead, drop it at /public/see-logo.svg and
 * swap <SeeMark/> for an <img> — the lockup spacing here is kept deliberately
 * simple to make that substitution trivial.
 */

const BLADES = [
  { d: 'M50,50 L50,4 A46,46 0 0 1 89.84,27 Z', fill: '#E9A400' },
  { d: 'M50,50 L89.84,27 A46,46 0 0 1 89.84,73 Z', fill: '#4CA22F' },
  { d: 'M50,50 L89.84,73 A46,46 0 0 1 50,96 Z', fill: '#1FA0A6' },
  { d: 'M50,50 L50,96 A46,46 0 0 1 10.16,73 Z', fill: '#1C7FD6' },
  { d: 'M50,50 L10.16,73 A46,46 0 0 1 10.16,27 Z', fill: '#C2178C' },
  { d: 'M50,50 L10.16,27 A46,46 0 0 1 50,4 Z', fill: '#E24A2E' },
];

// Hexagonal shutter opening (pointy-top hexagon, r≈16).
const HEX = '63.86,58 50,66 36.14,58 36.14,42 50,34 63.86,42';

export function SeeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 136 112" className={className} role="img" aria-label="SEE Services">
      {/* Orbit swoosh */}
      <path
        d="M19.5,43 A56,46 0 0 0 116.5,43"
        transform="translate(0,0)"
        fill="none"
        stroke="#6E86BF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g transform="translate(18,10)">
        {BLADES.map((b, i) => (
          <path key={i} d={b.d} fill={b.fill} />
        ))}
        <polygon points={HEX} fill="#ffffff" />
      </g>
    </svg>
  );
}

/** Full lockup: mark above the SEE wordmark and colour strapline. */
export function SeeLogoFull({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <SeeMark className="h-16 w-auto" />
      <div className="flex flex-col items-center">
        <span className="text-3xl font-black leading-none tracking-tight text-navy-800">SEE</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          <span className="text-[#4CA22F]">Comply</span>
          <span className="mx-1 text-navy-800">·</span>
          <span className="text-[#C2178C]">Maintain</span>
          <span className="mx-1 text-navy-800">·</span>
          <span className="text-[#1C7FD6]">Sustain</span>
        </span>
      </div>
    </div>
  );
}

/** Compact product lockup for the sidebar / headers. */
export function ProductLockup({ className, subdued = false }: { className?: string; subdued?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SeeMark className="h-9 w-auto shrink-0" />
      <div className="leading-tight">
        <div className={cn('text-sm font-semibold tracking-tight', subdued ? 'text-white' : 'text-navy-800')}>
          SEE CAFM Sync
        </div>
        <div className={cn('text-[11px]', subdued ? 'text-white/60' : 'text-muted-foreground')}>
          Powered by ProofWorks
        </div>
      </div>
    </div>
  );
}
