import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { setTransportOverride, isRemoteBrowser } from '@/lib/demo/config';
import { closeBrowser } from '@/lib/demo/browser';
import { createConcertoConnector } from '@/lib/integrations/concerto/connector';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';
import { demoGuard } from '../_guard';

export const dynamic = 'force-dynamic';
// A real browser signing into two systems over Browserbase runs ~40-60s.
export const maxDuration = 180;

/**
 * On-demand "watch a real browser sign in" proof.
 *
 * This is the honesty artifact for buyers: it opens a real cloud browser
 * (Browserbase) and signs into BOTH stand-in systems the way a person would —
 * no API, no shortcut. The connector publishes the session's PUBLIC live-view
 * URL the moment it opens (see lib/demo/browser.ts), which the demo surfaces as
 * a link anyone can watch without a Browserbase login.
 *
 * Deliberately READ-ONLY: it logs in and reads each system's screen, and changes
 * nothing. So a presenter can fire it at any point — including after the fast
 * Direct demo has finished — without disturbing the result on screen. The main
 * demo stays on its Direct transport throughout; the browser override here is
 * in-process and dies with this request.
 */
export async function POST(req: NextRequest) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  if (!isRemoteBrowser()) {
    return fail(
      'A hosted browser is not configured. Set BROWSERBASE_API_KEY (and DEMO_BASE_URL) first.',
      409,
    );
  }

  try {
    // Force a FRESH session and a fresh sign-in for this proof: drop any cached,
    // already-signed-in browser so the buyer actually watches the login happen.
    await closeBrowser();

    // Browser transport for THIS request only — not the stored default.
    setTransportOverride('browser');

    const joblogic = createJoblogicConnector();
    const concerto = createConcertoConnector();

    // Sign into each system in turn. testConnection logs in and reads the screen —
    // proof of a real browser session, without writing anything.
    const jl = await joblogic.testConnection();
    const co = await concerto.testConnection();

    // Leave the session OPEN so there is time to watch it in the live view; it
    // ends on its own Browserbase timeout, or when the next proof runs.
    return ok({
      signedIn: true,
      joblogic: jl.message,
      concerto: co.message,
    });
  } catch (error) {
    return handleRouteError(error);
  } finally {
    // Return the process to the stored transport so nothing else picks up browser.
    setTransportOverride(null);
  }
}
