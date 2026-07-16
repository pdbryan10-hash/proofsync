import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { ConcertoChrome } from '../chrome';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  'Awaiting Contractor': 'bg-slate-100 text-slate-600 border-slate-300',
  'In Progress': 'bg-sky-50 text-sky-800 border-sky-300',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Closed: 'bg-slate-100 text-slate-500 border-slate-300',
};

/** Concerto's work-order register — where the client waits for the paperwork. */
export default async function ConcertoWorkOrders() {
  const user = await currentUser('concerto');
  if (!user) redirect('/systems/concerto/login?next=/systems/concerto/work-orders');

  const wos = await targetWorkOrders();
  const rows = await wos.find({}).sort({ updatedAt: -1 }).limit(60).toArray();

  return (
    <ConcertoChrome user={user} title="Work Orders" breadcrumb="Home / Work Orders">
      <div className="overflow-hidden rounded-sm border border-[#c9d6e4] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#c9d6e4] bg-[#f4f7fa] text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Reference</th>
              <th className="px-4 py-2.5 font-semibold">Property</th>
              <th className="px-4 py-2.5 font-semibold">Summary</th>
              <th className="px-4 py-2.5 font-semibold">Contractor update</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No work orders.
                </td>
              </tr>
            )}
            {rows.map((wo) => {
              const populated = Object.values(wo.attributes ?? {}).filter(
                (v) => v !== null && v !== undefined && v !== '',
              ).length;
              return (
                <tr key={wo.reference} className="hover:bg-[#f7fafc]">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                    <Link
                      href={`/systems/concerto/work-orders/${wo.reference}`}
                      className="font-medium text-[#1e4d8c] hover:underline"
                    >
                      {wo.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{wo.property?.propertyName}</td>
                  <td className="max-w-[24rem] truncate px-4 py-2.5 text-slate-600">{wo.summary}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                    {populated === 0 ? (
                      <span className="text-slate-400">Not received</span>
                    ) : (
                      <span className="text-emerald-700">{populated} field(s) received</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLE[wo.status] ?? 'border-slate-300 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {wo.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ConcertoChrome>
  );
}
