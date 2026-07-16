import { Repeat } from 'lucide-react';

/**
 * The nine manual steps, shown rather than described. The point is that it LOOKS
 * exhausting — the visual is the argument. This replaces a paragraph that said the
 * same thing and was skipped.
 */
const STEPS = [
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

export function TediumSteps() {
  return (
    <div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="flex items-center gap-2.5 rounded-md border border-white/10 bg-navy-900/50 px-3 py-2.5"
          >
            <span className="font-mono text-[10px] text-white/30">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm text-white/75">{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-3 py-2.5">
        <Repeat className="size-4 shrink-0 text-danger" />
        <span className="text-sm font-semibold text-white">Then the next job. And the next. All day.</span>
      </div>
    </div>
  );
}
