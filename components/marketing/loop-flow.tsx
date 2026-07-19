import { ArrowRight, RotateCcw } from 'lucide-react';

/**
 * The hero attention-grabber: the whole job as a closed loop.
 *
 * Four stages, left to right, that start AND end in the client's system — with a
 * pulse animated along the path and a return arc that closes the loop, so it reads
 * as a loop at a glance. Each stage names the CATEGORY of system, not one product,
 * with example platforms beneath — the point being it works with whatever you run.
 */

const STAGES = [
  {
    n: '01',
    system: 'Your client’s system',
    egs: 'Concerto · Elogbooks · Planon · any CAFM',
    title: 'The job is raised',
    tone: 'client' as const,
  },
  {
    n: '02',
    system: 'Your system',
    egs: 'Joblogic · Simpro · BigChange · whatever you run',
    title: 'Done once, on site',
    tone: 'field' as const,
  },
  {
    n: '03',
    system: 'ProofSync',
    egs: 'matched · validated · written back',
    title: 'Moved both ways',
    tone: 'engine' as const,
  },
  {
    n: '04',
    system: 'Your client’s system',
    egs: 'the same one it started in',
    title: 'In step, verified',
    tone: 'client' as const,
  },
];

const TONE: Record<'client' | 'field' | 'engine', { card: string; badge: string; sys: string }> = {
  client: {
    card: 'border-[#0e6b3f]/30 bg-white',
    badge: 'bg-[#e7f0ea] text-[#0b5531]',
    sys: 'text-[#0b5531]',
  },
  field: {
    card: 'border-[#1a1b1f]/12 bg-white',
    badge: 'bg-[#f0eee6] text-[#5f6068]',
    sys: 'text-[#33343a]',
  },
  engine: {
    card: 'border-[#0e6b3f]/50 bg-[#0e6b3f] text-white shadow-lg shadow-[#0e6b3f]/25',
    badge: 'bg-white/20 text-white',
    sys: 'text-white',
  },
};

/** An animated connector: a track with a pulse that flows toward the next stage. */
function Flow() {
  return (
    <div className="relative flex items-center justify-center py-2 lg:h-full lg:w-10 lg:py-0">
      <div className="relative h-8 w-px overflow-hidden lg:h-px lg:w-full">
        <div className="absolute inset-0 bg-[#0e6b3f]/25" />
        <span className="ps-flow-dot absolute size-1.5 -translate-y-1/2 rounded-full bg-[#0e6b3f] shadow-[0_0_8px_2px_rgba(14,107,63,0.5)]" />
      </div>
      <ArrowRight className="absolute size-4 rotate-90 text-[#0e6b3f] lg:rotate-0" />
    </div>
  );
}

export function LoopFlow() {
  return (
    <div className="relative rounded-3xl border border-[#e6e1d6] bg-[#faf9f5] p-5 shadow-sm sm:p-7">
      <style>{`
        @keyframes psFlowX { 0%{left:-10%} 100%{left:110%} }
        @keyframes psFlowY { 0%{top:-20%} 100%{top:120%} }
        .ps-flow-dot{ top:50%; animation:psFlowY 1.8s linear infinite; }
        @media (min-width:1024px){ .ps-flow-dot{ top:50%; left:0; animation:psFlowX 1.8s linear infinite; } }
        @media (prefers-reduced-motion: reduce){ .ps-flow-dot{ animation:none; opacity:0; } }
      `}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#0e6b3f]/25 bg-[#e7f0ea] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#0e6b3f]">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0e6b3f] opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[#0e6b3f]" />
          </span>
          The whole job · round the loop
        </span>
        <span className="text-sm text-[#5f6068]">
          Starts and ends in your client’s system — <span className="font-semibold text-[#1a1b1f]">whatever platforms either of you run.</span>
        </span>
      </div>

      {/* The four stages, with an animated pulse flowing between them. */}
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {STAGES.map((s, i) => {
          const t = TONE[s.tone];
          return (
            <div key={s.n} className="contents">
              <div className={`flex flex-1 flex-col rounded-2xl border p-4 transition-transform sm:p-5 ${t.card}`}>
                <div className="flex items-center justify-between">
                  <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest ${t.badge}`}>
                    {s.n}
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${t.sys} opacity-90`}>
                    {s.system}
                  </span>
                </div>
                <p className={`mt-3 text-lg font-bold leading-tight ${s.tone === 'engine' ? 'text-white' : 'text-[#1a1b1f]'}`}>
                  {s.title}
                </p>
                <p className={`mt-1.5 text-[11px] leading-relaxed ${s.tone === 'engine' ? 'text-white/75' : 'text-[#8a8578]'}`}>
                  {s.egs}
                </p>
              </div>
              {i < STAGES.length - 1 && <Flow />}
            </div>
          );
        })}
      </div>

      {/* The return — closes the loop back to where it started. */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#0e6b3f]/35 bg-[#e7f0ea]/60 px-4 py-2.5">
        <RotateCcw className="size-4 shrink-0 text-[#0e6b3f]" />
        <p className="text-sm text-[#0b5531]">
          <span className="font-semibold">Nobody re-keys a thing — in either direction.</span> The loop closes itself, and only the exceptions reach a human.
        </p>
      </div>
    </div>
  );
}
