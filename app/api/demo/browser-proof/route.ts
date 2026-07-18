import type { NextRequest } from 'next/server';
import { ok, fail, handleRouteError } from '@/lib/http';
import { isRemoteBrowser } from '@/lib/demo/config';
import { runBrowserProofDrive } from '@/lib/demo/browser-proof-drive';
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
 * The drive is paced and types character by character so it is actually
 * watchable, and it drives the session's DEFAULT tab — the one the live-view URL
 * renders — so the live view isn't blank. It signs in only when signed out (you
 * log in once and reuse the session, as in production) and does not press Save,
 * so it never mutates the ledgered demo result. The main demo stays on its Direct
 * transport throughout.
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
    const steps = await runBrowserProofDrive();
    return ok({ signedIn: true, steps });
  } catch (error) {
    return handleRouteError(error);
  }
}
