import { ChevronRight } from 'lucide-react';

const STEPS = [
  'Job completed in Joblogic',
  'Reference matched',
  'Data validated',
  'Concerto updated',
  'Certificates transferred',
  'Result verified',
];

/** The horizontal value workflow shown under the hero (§24). */
export function WorkflowStrip() {
  return (
    <div className="scroll-x">
      <ol className="flex min-w-max items-center gap-1">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-navy-800">
              <span className="flex size-5 items-center justify-center rounded-full bg-navy-50 text-[10px] font-bold text-navy-800">
                {i + 1}
              </span>
              {step}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
