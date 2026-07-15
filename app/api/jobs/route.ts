import type { NextRequest } from 'next/server';
import { ok, handleRouteError } from '@/lib/http';
import { listJobs } from '@/lib/services/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobs = await listJobs({
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });
    return ok(jobs);
  } catch (error) {
    return handleRouteError(error);
  }
}
