import { ShieldCheck } from 'lucide-react';

/**
 * Cyber Essentials certification mark, attributed to ProofWorks Ltd (the entity
 * that holds the certification — ProofSync is a ProofWorks product). Kept as a
 * clean typographic badge rather than reproducing the official artwork.
 *
 * DISPLAY ONLY WHILE CURRENT: Cyber Essentials lapses annually. If the ProofWorks
 * certification is not renewed, remove this badge — a lapsed claim is worse than
 * none.
 */
export function CyberEssentialsBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border border-[#0e6b3f]/25 bg-white px-3 py-1.5 ${className}`}
    >
      <ShieldCheck className="size-5 shrink-0 text-[#0e6b3f]" />
      <span className="leading-tight">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-[#0b5531]">
          Cyber Essentials
        </span>
        <span className="block text-[11px] text-[#5f6068]">Certified · ProofWorks Ltd</span>
      </span>
    </span>
  );
}
