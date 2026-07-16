import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ok, fail, handleRouteError } from '@/lib/http';
import { enquirySchema } from '@/lib/domain/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/enquiries — capture a sales enquiry from the public pages.
 *
 * Public by necessity (no auth), so it is defended by: Zod validation, a honeypot
 * field, and hard length caps. The valuable payload is `targetSystems` — the
 * client CAFMs the contractor is re-keying into.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = enquirySchema.parse(body);

    // Honeypot: a real user never sees this field. Accept silently so bots don't learn.
    if (input.website) return ok({ received: true });

    await prisma.enquiry.create({
      data: {
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        sourceSystems: JSON.stringify(input.sourceSystems),
        targetSystems: JSON.stringify(input.targetSystems),
        otherSystems: input.otherSystems ?? null,
        jobsPerMonth: input.jobsPerMonth ?? null,
        message: input.message ?? null,
        pageSource: input.pageSource ?? null,
      },
    });

    // Log the demand signal (no PII beyond company) for quick visibility.
    console.log('[enquiry] captured', {
      company: input.company,
      targetSystems: input.targetSystems,
      sourceSystems: input.sourceSystems,
    });

    return ok({ received: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') return fail('Please check the form', 422);
    return handleRouteError(error);
  }
}
