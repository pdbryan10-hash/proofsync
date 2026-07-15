import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ok, handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/exceptions?status=OPEN */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const exceptions = await prisma.exception.findMany({
      where: status && status !== 'ALL' ? { status } : {},
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: { job: true },
    });
    return ok(exceptions);
  } catch (error) {
    return handleRouteError(error);
  }
}
