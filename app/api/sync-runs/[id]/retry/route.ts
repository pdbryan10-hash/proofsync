import { prisma } from '@/lib/db/prisma';
import { ok, fail, handleRouteError } from '@/lib/http';
import { requireRole, AccessDeniedError } from '@/lib/auth';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';

export const dynamic = 'force-dynamic';

/** POST /api/sync-runs/[id]/retry — re-attempt the sync for a run's job. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('operator');
    const { id } = await params;
    const run = await prisma.syncRun.findUnique({ where: { id } });
    if (!run) return fail('Sync run not found', 404);

    const dispatcher = getSyncDispatcher();
    const result = await dispatcher.dispatch({ jobId: run.jobId, triggerType: 'RETRY' });
    return ok(result);
  } catch (error) {
    if (error instanceof AccessDeniedError) return fail(error.message, error.status);
    return handleRouteError(error);
  }
}
