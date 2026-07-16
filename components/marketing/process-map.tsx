import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ProofSyncMark } from '@/components/brand/proofsync-logo';

/**
 * The one-to-many process map: contractor systems → ProofSync → client CAFMs.
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
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.6fr)]">
      {/* SOURCE */}
      <div className="rounded-xl border border-white/10 bg-navy-900/50 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Your system</p>
        <p className="mt-1 text-sm font-semibold text-white">Where the job is completed</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <Chip key={s} label={s} />
          ))}
        </div>
      </div>

      {/* ENGINE */}
      <div className="relative flex justify-center">
        <ArrowRight className="absolute -left-1 top-1/2 hidden size-4 -translate-y-1/2 text-white/25 lg:block" />
        <div className="rounded-xl border border-success/40 bg-success/[0.08] px-5 py-6 text-center">
          <ProofSyncMark className="mx-auto h-9 w-auto" />
          <p className="mt-3 text-sm font-bold text-white">ProofSync</p>
          <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-widest text-success">
            match
            <br />
            map
            <br />
            write
            <br />
            verify
          </p>
          <div className="mt-3 flex items-center justify-center gap-1 border-t border-white/10 pt-3">
            <ShieldCheck className="size-3 text-success" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">audited</span>
          </div>
        </div>
        <ArrowRight className="absolute -right-1 top-1/2 hidden size-4 -translate-y-1/2 text-white/25 lg:block" />
      </div>

      {/* TARGETS */}
      <div className="rounded-xl border border-white/10 bg-navy-900/50 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Your client&apos;s system</p>
        <p className="mt-1 text-sm font-semibold text-white">Whatever they happen to run</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TARGETS.map((t) => (
            <Chip key={t} label={t} />
          ))}
          <span className="inline-flex items-center rounded border border-dashed border-white/20 px-2 py-1 font-mono text-[11px] text-white/40">
            + yours
          </span>
        </div>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/70">
      {label}
    </span>
  );
}
