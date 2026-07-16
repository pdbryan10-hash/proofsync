import type { Browser, BrowserContext, Page } from 'playwright';
import { getDemoBaseUrl, isHeadedBrowser } from './config';
import { saveShot, type ShotStage } from './screenshots';
import { IntegrationUnavailableError } from '@/lib/errors/integration-errors';

/**
 * The browser the demo drives.
 *
 * WHY THIS EXISTS
 * ---------------
 * Where a vendor exposes no API, the only way in is the one a person has: open
 * the site, sign in, read the screen, type into the screen. This module owns the
 * Chromium instance that does that.
 *
 * WHY IT CANNOT RUN ON VERCEL
 * ---------------------------
 * There is no Chromium binary in the serverless runtime, and the function size
 * limits make shipping one a losing fight. This is a local — or containerised
 * worker — transport. A Vercel deployment stays on DEMO_TRANSPORT=direct.
 * `playwright` is a devDependency and is imported dynamically below precisely so
 * that a production build never has to resolve it.
 *
 * ONE BROWSER, TWO CONTEXTS
 * -------------------------
 * Joblogic and Concerto each get their own BrowserContext, which means their own
 * cookie jar. That is not tidiness: a single shared jar would let one system's
 * session leak into the other's requests, and the two systems are supposed to
 * know nothing about each other. Separate contexts is what two browsers on two
 * desks would be.
 */

type BrowserCache = {
  demoBrowser?: Promise<Browser>;
  demoContexts?: Map<string, BrowserContext>;
};

const cache = globalThis as unknown as BrowserCache;

async function launch(): Promise<Browser> {
  // Dynamic so the module is only ever resolved when the browser transport is
  // actually selected. See serverExternalPackages in next.config.mjs.
  const { chromium } = await import('playwright');
  try {
    return await chromium.launch({
      headless: !isHeadedBrowser(),
      // Slow the interactions down when the window is visible: an audience needs
      // to see the typing happen, and instant form-fill reads as a fake.
      slowMo: isHeadedBrowser() ? 120 : 0,
      args: ['--window-size=1360,900'],
    });
  } catch (error) {
    throw new IntegrationUnavailableError(
      `Could not launch Chromium — run "npx playwright install chromium". (${(error as Error).message})`,
    );
  }
}

export async function getBrowser(): Promise<Browser> {
  const existing = await cache.demoBrowser?.catch(() => undefined);
  if (existing?.isConnected()) return existing;

  // Relaunching invalidates every context that belonged to the old browser —
  // including the one someone closed by hand. Drop them with it.
  cache.demoContexts?.clear();

  cache.demoBrowser = launch()
    .then((browser) => {
      // Closing the window by hand should not wedge the demo: forget everything
      // so the next beat launches cleanly instead of failing on dead handles.
      browser.once('disconnected', () => {
        cache.demoBrowser = undefined;
        cache.demoContexts?.clear();
      });
      return browser;
    })
    .catch((err) => {
      cache.demoBrowser = undefined;
      throw err;
    });
  return cache.demoBrowser;
}

/**
 * A persistent context per system, so the session cookie survives between beats
 * and the connector only signs in when it genuinely has to — the same reason a
 * person doesn't log in again for every job.
 */
export async function getContext(system: 'joblogic' | 'concerto'): Promise<BrowserContext> {
  cache.demoContexts ??= new Map();

  // Resolve the browser FIRST: it relaunches itself if the last one died, and a
  // cached context is only valid against the browser that created it.
  const browser = await getBrowser();
  const existing = cache.demoContexts.get(system);

  // Identity check, not a liveness probe. `context.pages()` returns [] on a
  // closed context rather than throwing, so a try/catch around it silently
  // hands back a dead context and the failure surfaces later at newPage().
  // Comparing owners is the only reliable test.
  if (existing && existing.browser() === browser) return existing;
  if (existing) cache.demoContexts.delete(system);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    baseURL: getDemoBaseUrl(),
  });
  context.setDefaultTimeout(15_000);
  // Belt and braces: if anything closes this context, evict it immediately
  // rather than waiting for the next caller to trip over it.
  context.once('close', () => cache.demoContexts?.delete(system));
  cache.demoContexts.set(system, context);
  return context;
}

/** A single reusable page per system — the tab that stays open on the desk. */
export async function getPage(system: 'joblogic' | 'concerto'): Promise<Page> {
  let context = await getContext(system);
  const live = context.pages().find((p) => !p.isClosed());
  if (live) return live;

  try {
    return await context.newPage();
  } catch {
    // The context died between resolving it and using it (a reset closing the
    // browser mid-beat does exactly this). Rebuild once rather than fail a sync
    // over a stale handle.
    cache.demoContexts?.delete(system);
    context = await getContext(system);
    return context.newPage();
  }
}

/** Capture what is on screen right now and file it against a subject. */
export async function capture(
  page: Page,
  params: { subject: string; system: 'JOBLOGIC' | 'CONCERTO'; stage: ShotStage; caption: string },
): Promise<void> {
  try {
    const png = await page.screenshot({ type: 'png' });
    await saveShot({
      subject: params.subject,
      system: params.system,
      stage: params.stage,
      caption: params.caption,
      url: page.url(),
      png: png.toString('base64'),
    });
  } catch {
    // Evidence is valuable, but never worth failing a sync over. A missing shot
    // is a gap in the record; a thrown error here would be a false negative.
  }
}

export async function closeBrowser(): Promise<void> {
  const contexts = cache.demoContexts;
  if (contexts) {
    for (const ctx of contexts.values()) {
      await ctx.close().catch(() => undefined);
    }
    contexts.clear();
  }
  const browser = await cache.demoBrowser?.catch(() => undefined);
  await browser?.close().catch(() => undefined);
  cache.demoBrowser = undefined;
}
