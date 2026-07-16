import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { TARGET_FIELD_LABELS } from '@/lib/domain/field-labels';
import { ConcertoChrome } from '../../chrome';

export const dynamic = 'force-dynamic';

/**
 * The contractor-update form: the screen a person would otherwise re-key into,
 * and the one the browser transport fills in instead.
 *
 * Every writable attribute is a labelled <input>/<textarea> whose `name` is the
 * Concerto field key. The connector finds each one by its visible label — the
 * same handle a human uses — so nothing here is rigged in the automation's
 * favour. The Save button really does write to Concerto's database.
 */

/** The fields Concerto exposes for a contractor to complete, in screen order. */
const FORM_FIELDS: { name: string; type: 'text' | 'textarea' }[] = [
  { name: 'workCompletionDescription', type: 'textarea' },
  { name: 'contractorCompletionNotes', type: 'textarea' },
  { name: 'actualArrivalTime', type: 'text' },
  { name: 'actualDepartureTime', type: 'text' },
  { name: 'actualLabourDuration', type: 'text' },
  { name: 'actualCompletionDate', type: 'text' },
  { name: 'followOnRequired', type: 'text' },
  { name: 'contractorCost', type: 'text' },
];

export default async function ConcertoWorkOrder({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await currentUser('concerto');
  const { reference } = await params;
  if (!user) redirect(`/systems/concerto/login?next=/systems/concerto/work-orders/${reference}`);

  const query = await searchParams;
  const wos = await targetWorkOrders();
  const wo = await wos.findOne({ reference });
  if (!wo) notFound();

  const attributes = wo.attributes ?? {};

  return (
    <ConcertoChrome
      user={user}
      title={`Work Order ${wo.reference}`}
      breadcrumb={`Home / Work Orders / ${wo.reference}`}
    >
      <Link
        href="/systems/concerto/work-orders"
        className="mb-4 inline-block text-xs text-[#1e4d8c] hover:underline"
      >
        ← Back to register
      </Link>

      {query.saved === '1' && (
        <p
          role="status"
          className="mb-4 rounded-sm border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          Contractor update saved.
        </p>
      )}
      {query.error && (
        <p
          role="alert"
          className="mb-4 rounded-sm border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {query.error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-sm border border-[#c9d6e4] bg-white lg:col-span-1">
          <h2 className="border-b border-[#c9d6e4] bg-[#f4f7fa] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Details
          </h2>
          <dl className="space-y-3 p-4 text-sm">
            <Row label="Reference" value={wo.reference} mono />
            <Row label="Status" value={wo.status} />
            <Row label="Property" value={wo.property?.propertyName ?? '—'} />
            <Row label="Address" value={wo.property?.propertyAddress ?? '—'} />
            <Row label="Asset ID" value={wo.assetId ?? '—'} mono />
            <Row label="Summary" value={wo.summary} />
            <Row label="Last updated by" value={wo.lastUpdatedBy ?? 'Not yet updated'} />
          </dl>
        </section>

        <section className="rounded-sm border border-[#c9d6e4] bg-white lg:col-span-2">
          <h2 className="border-b border-[#c9d6e4] bg-[#f4f7fa] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contractor update
          </h2>

          <form method="post" action={`/systems/concerto/work-orders/${wo.reference}/save`} className="space-y-4 p-4">
            {FORM_FIELDS.map((field) => {
              const label = TARGET_FIELD_LABELS[field.name] ?? field.name;
              const value = attributes[field.name];
              const stringValue = value === null || value === undefined ? '' : String(value);
              return (
                <div key={field.name}>
                  <label
                    htmlFor={field.name}
                    className="block text-xs font-medium text-slate-600"
                  >
                    {label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      rows={3}
                      defaultValue={stringValue}
                      className="mt-1 block w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4d8c] focus:bg-white focus:outline-none"
                    />
                  ) : (
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      defaultValue={stringValue}
                      className="mt-1 block w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4d8c] focus:bg-white focus:outline-none"
                    />
                  )}
                </div>
              );
            })}

            <div>
              <label htmlFor="status" className="block text-xs font-medium text-slate-600">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={wo.status}
                className="mt-1 block w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4d8c] focus:bg-white focus:outline-none"
              >
                {['Awaiting Contractor', 'In Progress', 'Completed', 'Closed'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-sm bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173d70]"
              >
                Save
              </button>
              <span className="text-[11px] text-slate-400">
                Updates the work order record.
              </span>
            </div>
          </form>
        </section>

        <section className="rounded-sm border border-[#c9d6e4] bg-white lg:col-span-3">
          <h2 className="border-b border-[#c9d6e4] bg-[#f4f7fa] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documents
          </h2>
          {(wo.documents?.length ?? 0) === 0 ? (
            <p className="p-4 text-xs text-slate-400">No documents attached.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {wo.documents.map((d) => (
                <li key={d.documentId} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="font-mono text-slate-700">{d.fileName}</span>
                  <span className="ml-auto text-slate-400">
                    uploaded by {d.uploadedBy} ·{' '}
                    {new Date(d.uploadedAt).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ConcertoChrome>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-slate-800 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}
