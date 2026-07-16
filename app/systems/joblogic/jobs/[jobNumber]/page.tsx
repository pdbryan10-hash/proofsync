import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { sourceJobs } from '@/lib/demo/mongo';
import { JoblogicChrome } from '../../chrome';

export const dynamic = 'force-dynamic';

const fmt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * A Joblogic job, with its completion sheet.
 *
 * The browser transport reads every value it needs off this page. Each field is
 * a <dt>/<dd> pair with a stable, human label — the connector locates values by
 * their label text, which is what you are reduced to when there is no API and no
 * cooperation from the vendor. No test hooks: if it can read this, it is reading
 * what a person reads.
 */
export default async function JoblogicJob({ params }: { params: Promise<{ jobNumber: string }> }) {
  const user = await currentUser('joblogic');
  const { jobNumber } = await params;
  if (!user) redirect(`/systems/joblogic/login?next=/systems/joblogic/jobs/${jobNumber}`);

  const jobs = await sourceJobs();
  const job = await jobs.findOne({ jobNumber });
  if (!job) notFound();

  const sheet = job.completionSheet;

  return (
    <JoblogicChrome user={user} title={`Job ${job.jobNumber}`}>
      <Link href="/systems/joblogic/jobs" className="mb-4 inline-block text-xs text-[#c2410c] hover:underline">
        ← Back to jobs
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-[#101828]">Job details</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Job number" value={job.jobNumber} mono />
            <Field label="Status" value={job.status} />
            <Field label="Site" value={job.siteName} />
            <Field label="Site address" value={job.siteAddress} />
            <Field label="Asset reference" value={job.assetRef ?? '—'} mono />
            <Field label="Customer order ref" value={job.customerOrderRef ?? '—'} mono />
            <Field label="Engineer" value={job.engineer?.engineerName ?? '—'} />
            <Field label="Scheduled" value={fmt(job.scheduledDate)} />
            <div className="sm:col-span-2">
              <Field label="Description" value={job.description} />
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-[#101828]">Visit</h2>
          <dl className="mt-3 space-y-3">
            <Field label="Arrived at" value={fmt(job.visit?.arrivedAt)} />
            <Field label="Departed at" value={fmt(job.visit?.departedAt)} />
            <Field
              label="Minutes on site"
              value={job.visit?.minutesOnSite != null ? String(job.visit.minutesOnSite) : '—'}
            />
          </dl>

          <h2 className="mt-5 text-sm font-semibold text-[#101828]">Charges</h2>
          <dl className="mt-3 space-y-3">
            <Field label="Labour charge" value={money(job.charges?.labourCharge)} />
            <Field label="Materials charge" value={money(job.charges?.materialsCharge)} />
            <Field label="Total charge" value={money(job.charges?.totalCharge)} />
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Completion sheet</h2>
            <span className="text-[11px] text-slate-400">Revision {job.revision ?? 1}</span>
          </div>

          {!sheet ? (
            <p className="mt-3 rounded border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
              Not completed yet — the engineer has not submitted a sheet.
            </p>
          ) : (
            <dl className="mt-3 space-y-3">
              <Field label="Work carried out" value={sheet.workCarriedOut ?? '—'} />
              <Field label="Engineer comments" value={sheet.engineerComments ?? '—'} />
              <Field label="Follow-on required" value={sheet.followOnRequired ? 'Yes' : 'No'} />
              <Field label="Follow-on detail" value={sheet.followOnDetail ?? '—'} />
              <Field label="Completed at" value={fmt(job.completedAt)} />
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-[#101828]">Attachments</h2>
          {job.attachments.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">None.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {job.attachments.map((a) => (
                <li key={a.attachmentId} className="flex items-center gap-3 py-2 text-xs">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                    {a.category}
                  </span>
                  <span className="font-mono text-slate-700">{a.fileName}</span>
                  <span className="ml-auto text-slate-400">{(a.bytes / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </JoblogicChrome>
  );
}

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

/**
 * Label/value pair. The label text is the connector's only handle on the value,
 * so these strings are effectively an interface — changing one breaks the scrape,
 * which is exactly the fragility that makes DOM automation a last resort.
 */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
