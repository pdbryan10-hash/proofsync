import type { Locator, Page } from 'playwright-core';
import { getBrowser, closeBrowser, recordDualLiveViews } from './browser';
import { getDemoBaseUrl, DEMO_SOURCE_LOGIN, DEMO_TARGET_LOGIN } from './config';

/**
 * The "watch a real browser sign in" drive — now TWO tabs at once.
 *
 * The act opener shows both stand-in systems being signed into SIDE BY SIDE: one
 * tab drives Joblogic, another drives Concerto, and both sign in concurrently.
 * Each tab publishes its own Browserbase live-view URL (recordDualLiveViews), so
 * the demo curtain can embed both and a viewer watches the two logins happen at
 * the same time.
 *
 * It KEYS text in character by character (pressSequentially) so the sign-in is
 * visible, and forces a fresh session each time so the login always plays.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Type into a field at machine pace — visible characters, near-instant. */
async function keyInto(locator: Locator, text: string): Promise<void> {
  try {
    await locator.click({ timeout: 8_000 });
    await locator.fill('');
    await locator.pressSequentially(text, { delay: 1 });
  } catch {
    // Best-effort: a missing field must not abort the whole proof.
  }
}

/** Sign one already-on-its-login-page tab in, keying the credentials at machine pace. */
async function loginTab(
  page: Page,
  p: { userLabel: string; submitLabel: RegExp; username: string; password: string },
): Promise<void> {
  await keyInto(page.getByLabel(p.userLabel, { exact: true }), p.username);
  await wait(20);
  await keyInto(page.getByLabel('Password', { exact: true }), p.password);
  await wait(25);
  await page.getByRole('button', { name: p.submitLabel }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

export async function runBrowserProofDrive(): Promise<string[]> {
  const steps: string[] = [];
  const note = (s: string) => steps.push(s);
  const base = getDemoBaseUrl();

  // Fresh session so the sign-in always plays (a reused, signed-in session would
  // skip straight past the login).
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

  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  // Clear any carried-over session so BOTH systems actually show their LOGIN
  // page. With a cookie still set, /login redirects straight to the data (the
  // jobs / work-orders screen) and the sign-in we're here to show never appears.
  await ctx.clearCookies().catch(() => {});
  const jlPage = ctx.pages()[0] ?? (await ctx.newPage());
  const coPage = await ctx.newPage();
  jlPage.setDefaultTimeout(20_000);
  coPage.setDefaultTimeout(20_000);

  // Open both login screens first, so each tab has a URL the debug endpoint can
  // report — that's how we match a live-view to a system.
  await Promise.all([
    jlPage.goto(`${base}/systems/joblogic/login`, { waitUntil: 'domcontentloaded' }).catch(() => {}),
    coPage.goto(`${base}/systems/concerto/login`, { waitUntil: 'domcontentloaded' }).catch(() => {}),
  ]);
  note(`tabs: jl=${jlPage.url()} co=${coPage.url()}`);

  // Publish a live-view URL per tab so the curtain can embed both, then hold just
  // long enough for both embedded views to connect before the keying starts.
  await recordDualLiveViews();
  await wait(700);

  // Sign into BOTH systems at once.
  const [jl, co] = await Promise.allSettled([
    loginTab(jlPage, {
      userLabel: 'Username',
      submitLabel: /sign in/i,
      username: DEMO_SOURCE_LOGIN.username,
      password: DEMO_SOURCE_LOGIN.password,
    }),
    loginTab(coPage, {
      userLabel: 'User ID',
      submitLabel: /log in/i,
      username: DEMO_TARGET_LOGIN.username,
      password: DEMO_TARGET_LOGIN.password,
    }),
  ]);
  note(`joblogic: ${jl.status} at ${jlPage.url()}`);
  note(`concerto: ${co.status} at ${coPage.url()}`);

  // Linger a beat on the signed-in state; the session auto-releases on its timeout.
  await wait(350);
  return steps;
}
