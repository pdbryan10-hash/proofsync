import { ok, fail, handleRouteError } from '@/lib/http';
import { getJobDetail } from '@/lib/services/jobs';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJobDetail(id);
    if (!job) return fail('Job not found', 404);
    return ok(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
