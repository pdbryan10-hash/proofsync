import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowserbaseConfig, getDemoBaseUrl, isHeadedBrowser } from './config';
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
 * RUNNING IT ANYWHERE (Browserbase)
 * ---------------------------------
 * Serverless runtimes have no Chromium binary, so the browser transport used to
 * be local-only. With BROWSERBASE_API_KEY set, `launch`
 * instead CONNECTS over CDP to a hosted Chromium (Browserbase) — the exact same
 * driving code, but the browser lives in the cloud, so "sign in like a person"
 * runs on Vercel or anywhere. Without those vars it falls back to a local
 * Playwright launch (dev). Note: the remote browser must be able to reach the
 * stand-in systems, so DEMO_BASE_URL must be a public URL, not localhost.
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
  browserbaseProjectId?: string;
};

const cache = globalThis as unknown as BrowserCache;

/**
 * Resolve a Browserbase project id from the API key alone.
 *
 * The REST session-create still wants a projectId, but a user only ever has an
 * API key now — Browserbase resolves the project from it. So if BROWSERBASE_-
 * PROJECT_ID isn't set, ask the API which projects the key owns and use the
 * first. Cached for the life of the process; the key maps to one account.
 */
async function resolveProjectId(apiKey: string, explicit: string | null): Promise<string> {
  if (explicit) return explicit;
  if (cache.browserbaseProjectId) return cache.browserbaseProjectId;

  const res = await fetch('https://api.browserbase.com/v1/projects', {
    headers: { 'X-BB-API-Key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`Could not resolve a Browserbase project from the API key (${res.status}): ${await res.text()}`);
  }
  const projects = (await res.json()) as Array<{ id: string }>;
  const id = projects?.[0]?.id;
  if (!id) throw new Error('The Browserbase API key has no projects.');
  cache.browserbaseProjectId = id;
  return id;
}

async function launch(): Promise<Browser> {
  const bb = getBrowserbaseConfig();

  // Remote browser (Browserbase): connect over CDP to a hosted Chromium. This is
  // what lets the "log in like a person" transport run on serverless / anywhere.
  if (bb) {
    const { chromium } = await import('playwright-core');
    try {
      const projectId = await resolveProjectId(bb.apiKey, bb.projectId);
      const res = await fetch('https://api.browserbase.com/v1/sessions', {
        method: 'POST',
        headers: { 'X-BB-API-Key': bb.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, browserSettings: { viewport: { width: 1280, height: 800 } } }),
      });
      if (!res.ok) {
        throw new Error(`Browserbase session request failed (${res.status}): ${await res.text()}`);
      }
      const session = (await res.json()) as { id: string; connectUrl?: string };
      const connectUrl =
        session.connectUrl ??
        `wss://connect.browserbase.com?apiKey=${bb.apiKey}&sessionId=${session.id}`;
      return await chromium.connectOverCDP(connectUrl);
    } catch (error) {
      throw new IntegrationUnavailableError(
        `Could not connect to the remote browser (Browserbase): ${(error as Error).message}`,
      );
    }
  }

  // Local fallback (dev): a real Chromium on this machine via full Playwright.
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
