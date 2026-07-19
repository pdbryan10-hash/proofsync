import { Repeat, ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * The manual steps, shown rather than described — BOTH directions, because the
 * human bridge works both ways: every job the client raises comes IN by hand, and
 * every job you complete goes back OUT by hand. Showing both is what evidences the
 * 20-minute-a-job basis the calculator runs on (~10 in + ~10 out).
 */

const INBOUND = [
  'Watch the client’s portal',
  'Spot the newly raised job',
  'Key it into your system',
  'Assign it to an engineer',
];

const OUTBOUND = [
  'Open your system',
  'Read the engineer’s notes',
  'Work out time on site',
  'Download the certificate',
  'Log into the client’s portal',
  'Find the original job',
  'Type it all in again',
  'Upload the certificate',
  'Close the job',
];

function Group({
  dir,
  title,
  minutes,
  steps,
  start,
}: {
  dir: 'in' | 'out';
  title: string;
  minutes: string;
  steps: string[];
  start: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {dir === 'in' ? (
          <ArrowLeft className="size-4 text-[#0e6b3f]" />
        ) : (
          <ArrowRight className="size-4 text-[#0e6b3f]" />
        )}
        <span className="text-sm font-bold text-[#1a1b1f]">{title}</span>
        <span className="ml-auto font-mono text-[11px] font-semibold text-[#0e6b3f]">{minutes}</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s}
            className="flex items-center gap-2.5 rounded-md border border-[#e6e1d6] bg-white px-3 py-2.5"
          >
            <span className="font-mono text-[11px] text-[#a9a498]">{String(start + i).padStart(2, '0')}</span>
            <span className="text-sm text-[#33343a]">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TediumSteps() {
  return (
    <div className="space-y-5">
      <Group dir="in" title="Every job they raise — into your system" minutes="~10 min" steps={INBOUND} start={1} />
      <Group dir="out" title="Every job you complete — back into theirs" minutes="~10 min" steps={OUTBOUND} start={5} />
      <div className="flex items-center gap-2.5 rounded-md border border-[#b4652a]/30 bg-[#f6ece2] px-3 py-2.5">
        <Repeat className="size-4 shrink-0 text-[#b4652a]" />
        <span className="text-sm font-semibold text-[#1a1b1f]">
          Both directions, every job — then the next, and the next. That’s the 20 minutes.
        </span>
      </div>
    </div>
  );
}
