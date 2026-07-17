import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ProofSyncMark } from '@/components/brand/proofsync-logo';

/**
 * The one-to-many connection map: contractor systems → ProofSync → client CAFMs.
 * This is the thesis in a single picture — one engine, reaching a whole wall of
 * client systems — so it leads the page.
 *
 * HONESTY RULE: this shows the landscape ProofSync is built to work across, NOT a
 * claim of live connectors. Availability is stated plainly beneath. Never imply a
 * pairing is live that isn't — the brand is "Proof".
 */

const SOURCES = ['Joblogic', 'Simpro', 'BigChange', 'Commusoft', 'Protean', 'Klipboard', 'Field Service'];

const TARGETS = [
  'Concerto', 'Planon', 'Concept Evolution', 'QFM', 'MRI Evolution',
  'IBM Maximo', 'Archibus', 'Corrigo', 'ServiceChannel', 'Elogbooks',
  'Ostara', 'Micad', 'CAFM Explorer', 'Civica', 'ServiceNow',
  'Nuvolo', 'Facilio', 'Infor EAM', 'SAP EAM', 'Spacewell',
  'Trackplan', 'Asckey', 'Agility', 'Tabs FM', 'Yardi',
];

export function ProcessMap() {
  return (
    <div className="relative">
      {/* Flow rail behind the columns (desktop): data pulses through the engine. */}
      <div className="pointer-events-none absolute inset-x-6 top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="relative h-px w-full overflow-hidden bg-gradient-to-r from-transparent via-success/40 to-transparent">
          <span className="ps-beam-dot absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-success shadow-[0_0_10px_3px_rgba(21,128,61,0.7)]" />
          <span
            className="ps-beam-dot absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-success shadow-[0_0_10px_3px_rgba(21,128,61,0.7)]"
            style={{ animationDelay: '1.2s' }}
          />
        </div>
      </div>

      <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.9fr)] lg:gap-3">
        {/* SOURCE — where the job is completed */}
        <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-5 backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Your system</p>
          <p className="mt-1 text-sm font-semibold text-white">Where the job is completed</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </div>
        </div>

        {/* ENGINE — the glowing hub */}
        <div className="relative flex justify-center py-2 lg:py-0">
          <ArrowRight className="absolute -left-2 top-1/2 hidden size-4 -translate-y-1/2 text-success/50 lg:block" />
          <div className="relative">
            {/* expanding pulse ring */}
            <span className="ps-ring pointer-events-none absolute inset-0 rounded-2xl border border-success/40" />
            <div className="ps-engine-glow relative rounded-2xl border border-success/50 bg-gradient-to-b from-success/[0.16] to-success/[0.06] px-6 py-6 text-center">
              <ProofSyncMark className="mx-auto h-9 w-auto" />
              <p className="mt-3 text-sm font-bold text-white">ProofSync</p>
              <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-widest text-success">
                match<br />map<br />write<br />verify
              </p>
              <div className="mt-3 flex items-center justify-center gap-1 border-t border-white/10 pt-3">
                <ShieldCheck className="size-3 text-success" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-white/50">audited</span>
              </div>
            </div>
          </div>
          <ArrowRight className="absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 text-success/50 lg:block" />
        </div>

        {/* TARGETS — the wall of client systems (the wow) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-navy-800/80 to-navy-900/50 p-5 backdrop-blur">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-success/10 blur-3xl" />
          <div className="relative flex items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Your client&apos;s system</p>
              <p className="mt-1 text-sm font-semibold text-white">Whatever they happen to run</p>
            </div>
            <p className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-success">
              {TARGETS.length}+ platforms
            </p>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {TARGETS.map((t, i) => (
              <Chip key={t} label={t} animateIndex={i} block />
            ))}
            <span
              className="ps-chip-in inline-flex items-center justify-center rounded-md border border-dashed border-success/40 px-2 py-1.5 font-mono text-[11px] text-success"
              style={{ animationDelay: `${TARGETS.length * 35}ms` }}
            >
              + yours
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  animateIndex,
  block,
}: {
  label: string;
  animateIndex?: number;
  block?: boolean;
}) {
  const animated = animateIndex !== undefined;
  return (
    <span
      className={[
        'inline-flex items-center rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 font-mono text-[11px] text-white/75',
        'transition-colors hover:border-success/40 hover:bg-success/[0.08] hover:text-white',
        block ? 'justify-center text-center' : '',
        animated ? 'ps-chip-in' : '',
      ].join(' ')}
      style={animated ? { animationDelay: `${animateIndex! * 35}ms` } : undefined}
    >
      {label}
    </span>
  );
}
