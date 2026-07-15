import { ok, fail, handleRouteError } from '@/lib/http';
import { requireRole, AccessDeniedError } from '@/lib/auth';
import { resolveExceptionSchema } from '@/lib/domain/validation';
import { resolveException } from '@/lib/services/exceptions';

export const dynamic = 'force-dynamic';

/** POST /api/exceptions/[id]/resolve — supply a reference and/or retry. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('operator');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = resolveExceptionSchema.parse(body);

    const outcome = await resolveException(id, input);
    if (!outcome.ok && outcome.exceptionStatus === 'OPEN' && outcome.message.includes('not found')) {
      return fail(outcome.message, 404);
    }
    return ok(outcome);
  } catch (error) {
    if (error instanceof AccessDeniedError) return fail(error.message, error.status);
    return handleRouteError(error);
  }
}
