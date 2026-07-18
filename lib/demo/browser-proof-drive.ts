import type { Locator, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from './browser';
import { getDemoBaseUrl, DEMO_SOURCE_LOGIN, DEMO_TARGET_LOGIN } from './config';

/**
 * The "watch a real browser sign in" drive.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * Two things had to be right for a buyer to actually SEE it:
 *
 * 1. It drives the SESSION'S DEFAULT TAB — the one Browserbase's live-view URL
 *    points at. The connectors open their own browser contexts (separate cookie
 *    jars, correct for production), but the live view only shows the default tab,
 *    so a proof driven through new contexts leaves the live view blank. Here we
 *    drive the default tab on purpose, so what the drive does is what the buyer
 *    sees.
 *
 * 2. It KEYS text in character by character (pressSequentially) and PACES itself
 *    with deliberate pauses. fill() sets a value instantly — invisible — and an
 *    un-paced run is over before anyone opens the link.
 *
 * It signs in only when it is actually signed out (exactly as the real connector
 * does — you log in once and reuse the session), then opens a work order and
 * types into it. Read-mostly: it types illustrative text into the client screen
 * to show the keying, and does not press Save, so it never mutates the ledgered
 * demo result.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Type into a field the way a person does — one key at a time, visibly. */
async function keyInto(locator: Locator, text: string): Promise<void> {
  try {
    await locator.click({ timeout: 8_000 });
    await locator.fill('');
    // Letters appear one by one, but at machine speed — a fast, deliberate type,
    // not a person's pace and not an instant paste.
    await locator.pressSequentially(text, { delay: 14 });
  } catch {
    // Best-effort: a missing field must not abort the whole proof.
  }
}

/**
 * Land on `target`, signed in. Navigates there first; if the system bounces us to
 * its login screen we key the credentials in (visibly) and continue — otherwise
 * the existing session is reused and no login is shown, which is the honest
 * behaviour: you sign in once, not on every click.
 */
async function signedIn(
  page: Page,
  params: {
    target: string;
    loginPath: string;
    userLabel: string;
    submitLabel: RegExp;
    username: string;
    password: string;
  },
): Promise<void> {
  await page.goto(params.target, { waitUntil: 'domcontentloaded' });
  await wait(500);
  if (!page.url().includes(params.loginPath)) return; // already signed in

  await keyInto(page.getByLabel(params.userLabel, { exact: true }), params.username);
  await wait(60);
  await keyInto(page.getByLabel('Password', { exact: true }), params.password);
  await wait(80);
  // Each vendor names its submit button differently — Joblogic "Sign in",
  // Concerto "Log in" — so the caller supplies the label to match.
  await page.getByRole('button', { name: params.submitLabel }).click();
  await page.waitForLoadState('domcontentloaded');
  await wait(400);
}

export async function runBrowserProofDrive(
  opts: { typeIntoWorkOrder?: boolean } = {},
): Promise<string[]> {
  const steps: string[] = [];
  const note = (s: string) => steps.push(s);
  const base = getDemoBaseUrl();

  // Force a FRESH session for the proof, so the buyer actually watches the sign-in
  // every time. (Production reuses the session and logs in once — but the whole
  // point HERE is to watch it happen, and a reused, already-signed-in session
  // would skip straight past the login.) A new session also mints a new live-view
  // URL, which the button auto-opens.
  await closeBrowser().catch(() => {});

  let browser;
  try {
    browser = await getBrowser();
    note('browser: connected');
  } catch (e) {
    note(`browser: FAILED ${(e as Error).message}`);
    await closeBrowser().catch(() => {});
    return steps;
  }

  // The DEFAULT context/page of the connected session — the one the published
  // live-view URL renders. Reuse it; only create if the session somehow has none.
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(20_000);
  note(`page: ${context.pages().length} page(s), url=${page.url()}`);

  // Hold just long enough for the embedded live view to connect before the keying
  // starts — otherwise the first keystrokes happen before the view paints.
  await wait(1_500);

  // Each phase is best-effort: a step that fails (a selector that moved, a slow
  // page) must never abort the whole proof or 500 the request.
  // --- Joblogic (the contractor's system) ---
  try {
    await signedIn(page, {
      target: `${base}/systems/joblogic/jobs?status=Complete`,
      loginPath: '/systems/joblogic/login',
      userLabel: 'Username',
      submitLabel: /sign in/i,
      username: DEMO_SOURCE_LOGIN.username,
      password: DEMO_SOURCE_LOGIN.password,
    });
    note(`joblogic: at ${page.url()}`);
    await wait(300);
  } catch (e) {
    note(`joblogic: FAILED ${(e as Error).message}`);
  }

  // --- Concerto (the client's CAFM) ---
  try {
    await signedIn(page, {
      target: `${base}/systems/concerto/work-orders`,
      loginPath: '/systems/concerto/login',
      userLabel: 'User ID',
      submitLabel: /log in/i,
      username: DEMO_TARGET_LOGIN.username,
      password: DEMO_TARGET_LOGIN.password,
    });
    note(`concerto: at ${page.url()}`);
    await wait(300);
  } catch (e) {
    note(`concerto: FAILED ${(e as Error).message}`);
  }

  // Optional flourish: open a work order and type into it. Off by default — the
  // act openers only need to PROVE the login; the data movement itself runs on
  // the fast Direct transport, shown in the demo's own panels.
  if (opts.typeIntoWorkOrder) {
    try {
      const firstLink = page.locator('table tbody tr a').first();
      if ((await firstLink.count()) > 0) {
        await firstLink.click();
        await page.waitForLoadState('domcontentloaded');
        await wait(2_000);
      }
      const boxes = page.getByRole('textbox');
      const count = await boxes.count();
      const sample = ['Completed and verified on site', 'Parts fitted; follow-on booked'];
      const n = Math.min(count, sample.length);
      for (let i = 0; i < n; i++) {
        await keyInto(boxes.nth(i), sample[i] ?? 'Confirmed on site');
        await wait(800);
      }
      note(`work-order: typed into ${n} of ${count} field(s) at ${page.url()}`);
    } catch (e) {
      note(`work-order: FAILED ${(e as Error).message}`);
    }
  }

  // Do NOT force-close here: dropping the session while the curtain is still
  // showing it disconnects the live-view WebSocket in the viewer's face. The
  // session carries its own 180s timeout (see browser.ts) and auto-releases, and
  // the next drive's opening closeBrowser reclaims this instance's slot — so
  // nothing piles up without us cutting the view mid-watch.
  await wait(400);
  return steps;
}
