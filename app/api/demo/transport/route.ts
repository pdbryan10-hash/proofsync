import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { demoControl } from '@/lib/demo/mongo';
import { setTransportOverride, isRemoteBrowser } from '@/lib/demo/config';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';

/**
 * Flip the demo between the fast DIRECT trickle and the real-BROWSER proof
 * (Browserbase) at runtime — no env change, no redeploy. Stored on the control
 * doc so every beat and every viewer picks it up.
 *
 * Browser is refused unless a hosted browser is actually configured, so a
 * presenter can't flip into a mode that would fail on serverless.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  try {
    const body = (await req.json().catch(() => ({}))) as { transport?: string };
    const transport = body.transport === 'browser' ? 'browser' : 'direct';

    if (transport === 'browser' && !isRemoteBrowser()) {
      return fail(
        'Browser mode needs a hosted browser. Set BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID (and DEMO_BASE_URL) first.',
        409,
      );
    }

    await (await demoControl()).updateOne(
      { _id: 'demo-control' },
      { $set: { transportOverride: transport } },
      { upsert: true },
    );
    setTransportOverride(transport);

    return ok({ transport });
  } catch (error) {
    return handleRouteError(error);
  }
}
