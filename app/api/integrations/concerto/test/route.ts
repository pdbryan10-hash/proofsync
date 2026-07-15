import { prisma } from '@/lib/db/prisma';
import { ok, fail, handleRouteError } from '@/lib/http';
import { requireRole, AccessDeniedError } from '@/lib/auth';
import { createConcertoConnector } from '@/lib/integrations/concerto/connector';

export const dynamic = 'force-dynamic';

/** POST /api/integrations/concerto/test — connectivity check. */
export async function POST() {
  try {
    await requireRole('operator');
    const connector = createConcertoConnector();
    const result = await connector.testConnection();
    await prisma.integrationConnection.updateMany({
      where: { provider: 'CONCERTO' },
      data: { lastConnectionTestAt: new Date(), status: result.ok ? 'CONNECTED' : 'DEGRADED' },
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AccessDeniedError) return fail(error.message, error.status);
    return handleRouteError(error);
  }
}
