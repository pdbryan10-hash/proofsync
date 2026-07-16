import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/systems/auth';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';
import type { TargetWorkOrderDoc } from '@/lib/demo/schema';

export const dynamic = 'force-dynamic';

/** The attributes this screen lets a contractor write. */
const WRITABLE = [
  'workCompletionDescription',
  'contractorCompletionNotes',
  'actualArrivalTime',
  'actualDepartureTime',
  'actualLabourDuration',
  'actualCompletionDate',
  'followOnRequired',
  'contractorCost',
];

/**
 * Concerto's save handler — the real write behind the contractor-update form.
 *
 * Requires a valid session. An unauthenticated POST is bounced to the log-in
 * screen rather than honoured, so the browser transport genuinely has to be
 * signed in to change anything: the login is load-bearing, not decoration.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ reference: string }> }) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { reference } = await ctx.params;
  const user = await currentUser('concerto');
  if (!user) {
    const url = new URL('/systems/concerto/login', req.url);
    url.searchParams.set('next', `/systems/concerto/work-orders/${reference}`);
    return NextResponse.redirect(url, 303);
  }

  const wos = await targetWorkOrders();
  const wo = await wos.findOne({ reference });
  if (!wo) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  // The seeded outage, surfaced the way a vendor's UI would surface it: the save
  // is refused and the screen says so. The browser connector has to notice the
  // error on the page — it cannot rely on an HTTP status, because a human
  // wouldn't get one either. Clears after one failure so a retry succeeds.
  if (wo.simulateUpdateFailure) {
    await wos.updateOne({ reference }, { $set: { simulateUpdateFailure: false } });
    const url = new URL(`/systems/concerto/work-orders/${reference}`, req.url);
    url.searchParams.set(
      'error',
      'The service is temporarily unavailable. Your changes were not saved. Please try again.',
    );
    return NextResponse.redirect(url, 303);
  }

  const form = await req.formData();
  const attributes: Record<string, unknown> = { ...(wo.attributes ?? {}) };
  for (const field of WRITABLE) {
    const raw = form.get(field);
    if (raw === null) continue;
    const value = String(raw).trim();
    // A blank box means "not supplied", not "erase what's there" — a partially
    // filled form must never wipe a field the client already holds.
    if (value === '') continue;
    attributes[field] = value;
  }

  const status = String(form.get('status') ?? wo.status) as TargetWorkOrderDoc['status'];

  await wos.updateOne(
    { reference },
    {
      $set: {
        attributes,
        status,
        lastUpdatedBy: user.username,
        updatedAt: new Date(),
      },
    },
  );

  const url = new URL(`/systems/concerto/work-orders/${reference}`, req.url);
  url.searchParams.set('saved', '1');
  return NextResponse.redirect(url, 303);
}
