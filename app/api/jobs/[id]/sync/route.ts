import { ok, fail, handleRouteError } from '@/lib/http';
import { requireRole, AccessDeniedError } from '@/lib/auth';
import { manualSyncSchema } from '@/lib/domain/validation';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';

export const dynamic = 'force-dynamic';

/** POST /api/jobs/[id]/sync — manual JOBLOGIC → CONCERTO sync trigger. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('operator');
    const { id } = await params;

    let triggerType: 'MANUAL' | 'RETRY' = 'MANUAL';
    try {
      const body = await req.json();
      triggerType = manualSyncSchema.parse(body).triggerType;
    } catch {
      // empty body → default MANUAL
    }

    const dispatcher = getSyncDispatcher();
    const result = await dispatcher.dispatch({ jobId: id, triggerType });

    if (result.status === 'FAILED' && !result.syncRunId) {
      return fail(result.message, 404);
    }
    return ok(result);
  } catch (error) {
    if (error instanceof AccessDeniedError) return fail(error.message, error.status);
    return handleRouteError(error);
  }
}
