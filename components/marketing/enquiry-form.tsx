'use client';

import { useState } from 'react';
import { Loader2, ArrowRight, CheckCircle2, TriangleAlert } from 'lucide-react';

/**
 * The capture tool.
 *
 * This is NOT a contact form. The point of every submission is the answer to
 * "which client systems are you re-keying into?" — captured as structured chips
 * so it aggregates into a demand signal that ranks the connector roadmap.
 */

const TARGETS = [
  'Concerto', 'Planon', 'Concept Evolution', 'QFM', 'MRI Evolution',
  'IBM Maximo', 'Elogbooks', 'Corrigo', 'ServiceChannel', 'Ostara',
  'Micad', 'CAFM Explorer', 'Civica', 'ServiceNow', 'Archibus',
];
const SOURCES = ['Joblogic', 'Simpro', 'BigChange', 'Commusoft', 'Protean', 'Klipboard', 'In-house'];
const VOLUMES = ['Under 250', '250–1,000', '1,000–5,000', '5,000+'];

const INPUT =
  'w-full rounded-md border border-[#dcd6c8] bg-[#faf9f5] px-3 py-2.5 text-sm text-[#1a1b1f] placeholder:text-[#8a8578] focus:border-[#0e6b3f] focus:outline-none focus:ring-2 focus:ring-[#0e6b3f]/15';

export function EnquiryForm({ pageSource = 'sales' }: { pageSource?: string }) {
  const [targets, setTargets] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [volume, setVolume] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          company: fd.get('company') || undefined,
          otherSystems: fd.get('otherSystems') || undefined,
          message: fd.get('message') || undefined,
          website: fd.get('website') || undefined, // honeypot
          sourceSystems: sources,
          targetSystems: targets,
          jobsPerMonth: volume || undefined,
          pageSource,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Something went wrong — try info@proof-works.co.uk');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not send — please email info@proof-works.co.uk');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#0e6b3f]/30 bg-[#e7f0ea] p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-8 text-[#0e6b3f]" />
        <p className="mt-4 text-xl font-bold text-[#1a1b1f]">Got it — thank you.</p>
        <p className="mx-auto mt-2 max-w-md text-[#4b4c54]">
          We&apos;ll come back to you within one working day. If it&apos;s urgent,{' '}
          <a href="mailto:info@proof-works.co.uk" className="font-medium text-[#0e6b3f] underline">
            info@proof-works.co.uk
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[#e6e1d6] bg-white p-6 text-left shadow-xl lg:p-8"
    >
      {/* THE question — first, because it's the one that matters */}
      <fieldset>
        <legend className="text-base font-semibold text-[#1a1b1f]">
          Which client systems are you re-keying into?
        </legend>
        <p className="mt-1 text-sm text-[#5f6068]">Pick any that apply — this tells us exactly what to connect you to.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TARGETS.map((t) => (
            <Chip key={t} label={t} active={targets.includes(t)} onClick={() => toggle(targets, setTargets, t)} />
          ))}
        </div>
        <input name="otherSystems" placeholder="Something else? Name it here…" maxLength={300} className={`mt-3 ${INPUT}`} />
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-base font-semibold text-[#1a1b1f]">Where do your engineers complete jobs?</legend>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <Chip key={s} label={s} active={sources.includes(s)} onClick={() => toggle(sources, setSources, s)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-base font-semibold text-[#1a1b1f]">Completed jobs a month?</legend>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {VOLUMES.map((v) => (
            <Chip key={v} label={v} active={volume === v} onClick={() => setVolume(volume === v ? '' : v)} />
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <Field name="name" placeholder="Your name" required />
        <Field name="email" placeholder="Work email" type="email" required />
        <Field name="company" placeholder="Company" />
      </div>

      <textarea
        name="message"
        rows={2}
        maxLength={2000}
        placeholder="Anything else we should know? (optional)"
        className={`mt-3 ${INPUT}`}
      />

      {/* Honeypot — hidden from humans, catnip to bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-[#b4652a]/30 bg-[#f6ece2] px-3 py-2 text-sm text-[#8a3f1c]">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0e6b3f] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#0e6b3f]/20 transition-colors hover:bg-[#0b5531] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Prove it on our data
        </button>
        <p className="text-xs text-[#767680]">
          We&apos;ll only use this to talk to you about ProofSync. No list, no newsletter.
        </p>
      </div>
    </form>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
        active
          ? 'border-[#0e6b3f] bg-[#e7f0ea] font-semibold text-[#0e6b3f]'
          : 'border-[#e0dbcd] bg-[#f7f5ef] text-[#4b4c54] hover:border-[#0e6b3f]/40 hover:text-[#0e6b3f]'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ name, placeholder, type = 'text', required }: { name: string; placeholder: string; type?: string; required?: boolean }) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder + (required ? ' *' : '')}
      maxLength={200}
      className={INPUT}
    />
  );
}
