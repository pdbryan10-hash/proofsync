/**
 * A static, deliberately-unreadable recreation of the live-sync demo, used as a
 * teasing background behind the booking CTA. It is the product, blurred: enough
 * to recognise the closed-loop console, not enough to read. No data, no API, no
 * interactivity — it always renders, and it gives nothing away.
 *
 * Everything is aria-hidden and pointer-events-none; it is pure decoration.
 */

const STEPS: { n: string; title: string; sub: string; count?: string; tone: string }[] = [
  { n: '01', title: 'Client raises the job', sub: 'in their system', count: '40', tone: 'client' },
  { n: '02', title: 'Work Intake pulls it', sub: 'reference kept', tone: 'engine' },
  { n: '03', title: 'Dispatched to the engineer', sub: 'in your system', count: '40', tone: 'field' },
  { n: '04', title: 'Completed → returned & verified', sub: 'the outbound sync', tone: 'engine' },
  { n: '05', title: 'Back in their system, verified', sub: 'both sides agree', count: '37', tone: 'client' },
];

const TONE: Record<string, string> = {
  client: 'border-emerald-500/40 bg-emerald-50 text-emerald-900',
  engine: 'border-indigo-500/40 bg-indigo-50 text-indigo-900',
  field: 'border-slate-400/40 bg-slate-100 text-slate-800',
};

const PANELS = [
  { name: 'Concerto', tag: 'client raises', head: 'bg-emerald-700' },
  { name: 'Joblogic', tag: 'dispatched & done', head: 'bg-navy-900' },
  { name: 'ProofSync', tag: 'the sync ledger', head: 'bg-indigo-600' },
  { name: 'Concerto', tag: 'back, verified', head: 'bg-emerald-700' },
] as const;

function Bar({ w }: { w: string }) {
  return <div className="h-2 rounded-full bg-black/10" style={{ width: w }} />;
}

export function DemoTease() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* The demo, blurred past reading and washed toward the paper background. */}
      <div className="absolute inset-0 origin-top scale-[1.04] opacity-[0.5] blur-[7px]">
        <div className="mx-auto max-w-[1500px] px-6 pt-8">
          {/* Act 3 banner */}
          <div className="rounded-2xl bg-[radial-gradient(130%_130%_at_20%_-20%,#0e6b3f_0%,#0b4f30_55%,#082419_100%)] px-8 py-6 text-white shadow-xl">
            <div className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
              Act 3 · Closed loop
            </div>
            <div className="mt-2 h-6 w-[46%] rounded bg-white/25" />
            <div className="mt-2 h-3 w-[62%] rounded bg-white/15" />
          </div>

          {/* Five-step board */}
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className={`rounded-xl border p-4 shadow-sm ${TONE[s.tone]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">{s.n}</span>
                  <span className="size-4 rounded-full border-2 border-current opacity-50" />
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug">{s.title}</p>
                <p className="text-xs opacity-70">{s.sub}</p>
                {s.count && <p className="mt-2 text-2xl font-black tabular-nums">{s.count}</p>}
              </div>
            ))}
          </div>

          {/* Exceptions strip */}
          <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-5 py-4">
            <div className="h-3 w-40 rounded bg-amber-500/40" />
            <div className="mt-3 space-y-2">
              <Bar w="55%" />
              <Bar w="48%" />
            </div>
          </div>

          {/* Four record panels */}
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            {PANELS.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <div className={`flex items-center justify-between px-5 py-3 text-white ${p.head}`}>
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80">{p.tag}</span>
                </div>
                <div className="space-y-4 p-4">
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="rounded-lg border border-black/10 p-3">
                      <Bar w="70%" />
                      <div className="mt-2 space-y-1.5">
                        <Bar w="90%" />
                        <Bar w="55%" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wash it into the page so it reads as atmosphere, never as content. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f7f5ef]/70 via-[#f7f5ef]/85 to-[#f7f5ef]" />
    </div>
  );
}
