import { prisma } from '@/lib/db/prisma';
import { ok, fail, handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/sync-runs/[id] — a run with its full audit timeline. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await prisma.syncRun.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } }, job: true },
    });
    if (!run) return fail('Sync run not found', 404);
    return ok(run);
  } catch (error) {
    return handleRouteError(error);
  }
}
