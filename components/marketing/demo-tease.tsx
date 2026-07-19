/**
 * A vivid but deliberately-unreadable recreation of the live-sync demo, used as a
 * full-bleed teasing background behind the booking form. It is the product, seen
 * through frosted glass: colourful and clearly the closed-loop console, blurred
 * just past the point of reading. No data, no API, no interactivity.
 *
 * Everything is aria-hidden and pointer-events-none; it is pure atmosphere.
 */

const STEPS: { n: string; title: string; sub: string; count?: string; tone: string }[] = [
  { n: '01', title: 'Client raises the job', sub: 'in their system', count: '40', tone: 'client' },
  { n: '02', title: 'Work Intake pulls it', sub: 'reference kept', tone: 'engine' },
  { n: '03', title: 'Dispatched to the engineer', sub: 'in your system', count: '40', tone: 'field' },
  { n: '04', title: 'Completed → returned & verified', sub: 'the outbound sync', tone: 'engine' },
  { n: '05', title: 'Back in their system, verified', sub: 'both sides agree', count: '37', tone: 'client' },
];

const TONE: Record<string, string> = {
  client: 'border-emerald-500/50 bg-emerald-50 text-emerald-900',
  engine: 'border-indigo-500/50 bg-indigo-50 text-indigo-900',
  field: 'border-slate-400/50 bg-slate-100 text-slate-800',
};

const PANELS = [
  { name: 'Concerto', tag: 'client raises', head: 'bg-emerald-700' },
  { name: 'Joblogic', tag: 'dispatched & done', head: 'bg-[#161c4a]' },
  { name: 'ProofSync', tag: 'the sync ledger', head: 'bg-indigo-600' },
  { name: 'Concerto', tag: 'back, verified', head: 'bg-emerald-700' },
];

function Bar({ w, tone = 'bg-black/10' }: { w: string; tone?: string }) {
  return <div className={`h-2 rounded-full ${tone}`} style={{ width: w }} />;
}

export function DemoTease() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* The demo, full-bleed — lightly blurred so it's clearly visible and
          obviously the product, just soft enough that you can't read the detail. */}
      <div className="absolute inset-x-0 top-0 origin-top scale-[1.12] opacity-[0.97] blur-[2px] saturate-[1.05]">
        <div className="mx-auto max-w-[1600px] px-6 pt-6">
          {/* Console header mock */}
          <div className="flex items-center justify-between rounded-t-xl border border-black/10 bg-white/90 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 rounded bg-[#1a1b1f]/70" />
              <div className="flex gap-1 rounded-full bg-black/5 p-0.5">
                <span className="h-5 w-16 rounded-full bg-transparent" />
                <span className="h-5 w-24 rounded-full bg-transparent" />
                <span className="h-5 w-20 rounded-full bg-[#0e6b3f]" />
              </div>
            </div>
            <div className="h-6 w-28 rounded-md bg-[#161c4a]" />
          </div>

          {/* Act 3 banner */}
          <div className="rounded-2xl bg-[radial-gradient(130%_130%_at_20%_-20%,#0e6b3f_0%,#0b4f30_55%,#082419_100%)] px-8 py-6 text-white shadow-xl">
            <div className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
              Act 3 · Closed loop
            </div>
            <div className="mt-2 h-6 w-[46%] rounded bg-white/30" />
            <div className="mt-2 h-3 w-[62%] rounded bg-white/20" />
          </div>

          {/* Five-step board */}
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className={`rounded-xl border p-4 shadow-sm ${TONE[s.tone]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">{s.n}</span>
                  <span className="size-4 rounded-full border-2 border-current opacity-60" />
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug">{s.title}</p>
                <p className="text-xs opacity-70">{s.sub}</p>
                {s.count && <p className="mt-2 text-2xl font-black tabular-nums">{s.count}</p>}
              </div>
            ))}
          </div>

          {/* Exceptions strip */}
          <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 px-5 py-4">
            <div className="h-3 w-40 rounded bg-amber-500/50" />
            <div className="mt-3 space-y-2">
              <Bar w="55%" tone="bg-amber-900/15" />
              <Bar w="48%" tone="bg-amber-900/15" />
            </div>
          </div>

          {/* Four record panels */}
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            {PANELS.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md">
                <div className={`flex items-center justify-between px-5 py-3 text-white ${p.head}`}>
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80">{p.tag}</span>
                </div>
                <div className="space-y-4 p-4">
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="rounded-lg border border-black/10 p-3">
                      <Bar w="70%" tone="bg-emerald-700/25" />
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

      {/* Melt only the very top and bottom edges into the header/footer; leave the
          middle fully visible. No heavy tint — the point is to SEE the product. */}
      <div className="absolute inset-0 bg-[#f7f5ef]/8" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#f7f5ef] via-transparent via-45% to-[#f7f5ef]" />
    </div>
  );
}
