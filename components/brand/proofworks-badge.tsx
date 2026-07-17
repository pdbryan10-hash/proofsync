import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ProofWorks parent mark — three converging bars into a teal-tipped arrow, the
 * "turning friction into forward motion" motif from the ProofWorks identity.
 * Inline SVG so the endorsement stays crisp at small sizes.
 */
export function ProofWorksMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} role="img" aria-label="ProofWorks" fill="none">
      <path d="M3 5 H19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 12 H27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 19 H19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M23 5 L34 12 L23 19"
        stroke="#2dd4bf"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Endorsement lockup shown beneath ProofSync — "part of the ProofWorks family".
 * Deliberately quiet: it lends the credibility of a parent company without
 * competing with the product brand above it.
 */
export function ProofWorksEndorsement({ className }: { className?: string }) {
  return (
    <a
      href="https://proof-works.co.uk"
      target="_blank"
      rel="noreferrer"
      title="ProofSync is a ProofWorks product — see what we build"
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border border-[#dcd6c8] bg-white px-2.5 py-1 shadow-sm transition-colors hover:border-[#0e6b3f]/40 hover:bg-[#e7f0ea]',
        className,
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#767680]">Part of</span>
      <ProofWorksMark className="h-3.5 w-auto text-[#1a1b1f]" />
      <span className="text-[13px] font-bold tracking-tight text-[#1a1b1f]">Proofworks</span>
      <ArrowUpRight className="size-3 text-[#a9a498] transition-colors group-hover:text-[#0e6b3f]" />
    </a>
  );
}
