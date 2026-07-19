import { ArrowRight } from 'lucide-react';

/**
 * The closed loop as four tiles — the same shape the demo shows: the job starts
 * and ends in the client's system, and ProofSync moves it round both ways.
 *   Client raises → into Joblogic → ProofSync writes it back → client, verified.
 */

const TILES = [
  {
    n: '01',
    system: 'Your client’s system',
    title: 'The job is raised',
    body: 'A new work order appears in their CAFM. ProofSync sees it the moment it does.',
    tone: 'client' as const,
  },
  {
    n: '02',
    system: 'Joblogic',
    title: 'Brought in, done once',
    body: 'Created in your system with the client’s reference kept, dispatched, and completed on site — once.',
    tone: 'field' as const,
  },
  {
    n: '03',
    system: 'ProofSync',
    title: 'Matched, written back',
    body: 'Validated, mapped to the client’s format, written into the original job, certificates transferred.',
    tone: 'engine' as const,
  },
  {
    n: '04',
    system: 'Your client’s system',
    title: 'In step, verified',
    body: 'Re-read and confirmed. Both systems agree — and nobody re-keyed a thing, at either end.',
    tone: 'client' as const,
  },
];

const TONE: Record<string, string> = {
  client: 'border-[#0e6b3f]/25 bg-[#e7f0ea]',
  field: 'border-[#1a1b1f]/15 bg-white',
  engine: 'border-[#0e6b3f]/40 bg-white ring-1 ring-[#0e6b3f]/15',
};

export function LoopFlow() {
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
      {TILES.map((t, i) => (
        <div key={t.n} className="contents">
          <div className={`flex flex-col rounded-xl border p-5 ${TONE[t.tone]}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8a8578]">{t.n}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#0e6b3f]">{t.system}</span>
            </div>
            <p className="mt-2 text-base font-bold text-[#1a1b1f]">{t.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5f6068]">{t.body}</p>
          </div>
          {i < TILES.length - 1 && (
            <div className="flex items-center justify-center py-1 lg:py-0">
              <ArrowRight className="size-5 rotate-90 text-[#0e6b3f]/50 lg:rotate-0" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
