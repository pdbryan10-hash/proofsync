import { cn } from '@/lib/utils';

/**
 * ProofSync brand mark — a ProofWorks product.
 *
 * The mark reads as "verified sync": a green sync ring orbiting a navy disc that
 * carries a white check. It deliberately encodes the differentiator — this is not
 * a dumb pipe between systems; every write is verified and audited.
 *
 * Rendered as inline SVG so it stays crisp at any size with no binary asset.
 */
export function ProofSyncMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="ProofSync">
      {/* Sync ring — open on the right to read as motion/refresh */}
      <path
        d="M38.56,36.21 A19,19 0 1 1 38.56,11.79"
        fill="none"
        stroke="#15803d"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Proof disc */}
      <circle cx="24" cy="24" r="13" fill="#262a63" />
      {/* Verified check */}
      <path
        d="M17.5,24.2 L21.8,28.5 L30.5,19.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full ProofSync wordmark lockup. `size` scales the whole lockup together. */
export function ProofSyncLogo({
  className,
  subdued = false,
  size = 'md',
}: {
  className?: string;
  subdued?: boolean;
  size?: 'md' | 'lg';
}) {
  const mark = size === 'lg' ? 'h-11 w-auto shrink-0' : 'h-8 w-auto shrink-0';
  const word = size === 'lg' ? 'text-3xl font-bold tracking-tight' : 'text-xl font-bold tracking-tight';
  return (
    <div className={cn('flex items-center', size === 'lg' ? 'gap-3' : 'gap-2.5', className)}>
      <ProofSyncMark className={mark} />
      <span className={cn(word, subdued ? 'text-white' : 'text-navy-800')}>
        Proof<span className={subdued ? 'text-[#4ade80]' : 'text-success'}>Sync</span>
      </span>
    </div>
  );
}

/** Compact product lockup for the sidebar / headers. */
export function ProductLockup({ className, subdued = false }: { className?: string; subdued?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ProofSyncMark className="h-9 w-auto shrink-0" />
      <div className="leading-tight">
        <div className={cn('text-sm font-semibold tracking-tight', subdued ? 'text-white' : 'text-navy-800')}>
          Proof<span className={subdued ? 'text-[#4ade80]' : 'text-success'}>Sync</span>
        </div>
        <div className={cn('text-[11px]', subdued ? 'text-white/60' : 'text-muted-foreground')}>
          Powered by ProofWorks
        </div>
      </div>
    </div>
  );
}
