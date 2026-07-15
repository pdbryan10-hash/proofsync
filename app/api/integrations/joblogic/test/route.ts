import { prisma } from '@/lib/db/prisma';
import { ok, handleRouteError } from '@/lib/http';
import { requireRole, AccessDeniedError } from '@/lib/auth';
import { fail } from '@/lib/http';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';

export const dynamic = 'force-dynamic';

/** POST /api/integrations/joblogic/test — connectivity check. */
export async function POST() {
  try {
    await requireRole('operator');
    const connector = createJoblogicConnector();
    const result = await connector.testConnection();
    await prisma.integrationConnection.updateMany({
      where: { provider: 'JOBLOGIC' },
      data: { lastConnectionTestAt: new Date(), status: result.ok ? 'CONNECTED' : 'DEGRADED' },
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AccessDeniedError) return fail(error.message, error.status);
    return handleRouteError(error);
  }
}
