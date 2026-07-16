import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { sourceJobs } from '@/lib/demo/mongo';
import type { SourceJobDoc } from '@/lib/demo/schema';
import { JoblogicChrome } from '../chrome';

export const dynamic = 'force-dynamic';

const STATUSES = ['Allocated', 'Travelling', 'On Site', 'Complete'] as const;

/** Only a known status reaches the query — a URL param is never a filter. */
function asStatus(value: string | undefined): SourceJobDoc['status'] | null {
  return STATUSES.includes(value as SourceJobDoc['status'])
    ? (value as SourceJobDoc['status'])
    : null;
}

const STATUS_STYLE: Record<string, string> = {
  Allocated: 'bg-slate-100 text-slate-600',
  Travelling: 'bg-sky-100 text-sky-700',
  'On Site': 'bg-amber-100 text-amber-700',
  Complete: 'bg-emerald-100 text-emerald-700',
};

/**
 * Joblogic's job list.
 *
 * The browser transport reads this table. It is deliberately an ordinary
 * semantic <table> with a row per job — the connector finds jobs by locating
 * rows and reading cells, exactly as it would have to against a vendor's grid.
 * No data attributes were added to make the scraping easy; if the connector can
 * read this, it is reading the screen.
 */
export default async function JoblogicJobs({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await currentUser('joblogic');
  if (!user) redirect('/systems/joblogic/login?next=/systems/joblogic/jobs');

  const params = await searchParams;
  const filter = asStatus(params.status);

  const jobs = await sourceJobs();
  const rows = await jobs
    .find(filter ? { status: filter } : {})
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray();

  return (
    <JoblogicChrome user={user} title="Jobs">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['All', 'Allocated', 'Travelling', 'On Site', 'Complete'].map((s) => {
          const active = s === 'All' ? !filter : filter === s;
          return (
            <Link
              key={s}
              href={s === 'All' ? '/systems/joblogic/jobs' : `/systems/joblogic/jobs?status=${encodeURIComponent(s)}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                active ? 'bg-[#101828] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-slate-500">{rows.length} job(s)</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Job no.</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Engineer</th>
              <th className="px-4 py-2.5 font-medium">Customer order ref</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No jobs.
                </td>
              </tr>
            )}
            {rows.map((job) => (
              <tr key={job.jobNumber} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                  <Link
                    href={`/systems/joblogic/jobs/${job.jobNumber}`}
                    className="font-medium text-[#c2410c] hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{job.siteName}</td>
                <td className="max-w-[22rem] truncate px-4 py-2.5 text-slate-600">
                  {job.description}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {job.engineer?.engineerName ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                  {job.customerOrderRef ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLE[job.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JoblogicChrome>
  );
}
