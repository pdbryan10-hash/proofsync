/**
 * Demo-mode configuration.
 *
 * The demo models a contractor's job-management system (Joblogic) and a client's
 * CAFM (Concerto) as two genuinely separate databases, and drives ProofSync's
 * real sync engine between them on a fixed beat.
 *
 * Everything here is server-only and inert unless DEMO_MODE=1.
 */

/** Master switch. Every /api/demo/* route and the /demo console 404 without it. */
export function isDemoEnabled(): boolean {
  return process.env.DEMO_MODE === '1';
}

/**
 * Seconds between sync beats. The demo console pings the tick endpoint more
 * often than this; the SERVER decides whether a beat is actually due, so the
 * cadence is a property of the system rather than of whoever has a tab open.
 */
export function getTickSeconds(): number {
  const raw = Number(process.env.DEMO_TICK_SECONDS);
  return Number.isFinite(raw) && raw >= 2 ? raw : 30;
}

/** How many new completed jobs the source system produces per beat (0..max). */
export function getDripPerTick(): number {
  const raw = Number(process.env.DEMO_DRIP_PER_TICK);
  return Number.isFinite(raw) && raw >= 0 ? raw : 3;
}

/**
 * How the connectors reach the two stand-in systems.
 *
 *   direct  — read and write their databases. Fast, robust, runs anywhere.
 *             Models the session lifecycle but does not prove the access method.
 *   browser — drive a real Chromium: fill the login form, read the rendered job
 *             list, type into the target's form, click Save, re-read the page.
 *             This is the real proof for a vendor with no API.
 *
 * IMPORTANT: `browser` CANNOT run on Vercel. There is no Chromium binary in the
 * serverless runtime and the function size limits fight you. It is a local
 * (or containerised worker) transport. A Vercel deployment must stay on `direct`.
 */
export type DemoTransport = 'direct' | 'browser';

export function getDemoTransport(): DemoTransport {
  return process.env.DEMO_TRANSPORT === 'browser' ? 'browser' : 'direct';
}

export function isBrowserTransport(): boolean {
  return getDemoTransport() === 'browser';
}

/**
 * Where the stand-in systems' own web UIs are served from. The browser transport
 * points Chromium at these, so it must be an address the machine running the
 * browser can actually reach.
 */
export function getDemoBaseUrl(): string {
  return process.env.DEMO_BASE_URL || 'http://localhost:3000';
}

/**
 * Show the browser window. Headed is the point of a live demo — a prospect
 * watching Chromium type into the client's system is the whole argument. Set
 * DEMO_HEADLESS=1 to run it invisibly (the screenshots still land in the ledger).
 */
export function isHeadedBrowser(): boolean {
  return process.env.DEMO_HEADLESS !== '1';
}

/**
 * Driving a browser costs roughly 10–20s per job against ~4.5s for a direct
 * write, so a beat has to attempt far fewer of them or the route's 60s budget
 * is gone. Overflow stays PENDING for the next beat.
 */
export function getMaxDispatchesPerTick(): number {
  const raw = Number(process.env.DEMO_MAX_SYNCS_PER_TICK);
  if (Number.isFinite(raw) && raw > 0) return raw;
  // Deliberately a slow trickle in direct mode: syncing the whole batch in one
  // or two beats reads as "everything succeeded at once". A few per beat lets a
  // viewer watch the Joblogic jobs cross into Concerto one cluster at a time.
  return isBrowserTransport() ? 2 : 3;
}

/**
 * Swap the database name on a Mongo connection string, preserving credentials
 * and options verbatim.
 *
 * Deliberately string-surgery rather than `new URL()`: round-tripping through
 * URL re-encodes the userinfo, which corrupts passwords containing reserved
 * characters. A valid connection string already has those percent-encoded, so
 * the host section can be located by the first '/' after the scheme.
 */
export function withDatabaseName(uri: string, dbName: string): string {
  const queryAt = uri.indexOf('?');
  const beforeQuery = queryAt === -1 ? uri : uri.slice(0, queryAt);
  const query = queryAt === -1 ? '' : uri.slice(queryAt);

  const schemeEnd = beforeQuery.indexOf('://');
  if (schemeEnd === -1) {
    throw new Error('DATABASE_URL is not a valid Mongo connection string.');
  }
  const hostStart = schemeEnd + 3;
  const pathSlash = beforeQuery.indexOf('/', hostStart);
  const base = pathSlash === -1 ? beforeQuery : beforeQuery.slice(0, pathSlash);

  return `${base}/${dbName}${query}`;
}

function requireBaseUri(): string {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL is not set — demo mode cannot connect.');
  return uri;
}

/**
 * Connection string for the SOURCE system's database (Joblogic stand-in).
 * Defaults to a separate database on the same cluster as ProofSync, so the demo
 * needs no extra infrastructure. Override to put it on its own cluster entirely.
 */
export function getSourceDbUri(): string {
  return (
    process.env.DEMO_JOBLOGIC_DB_URL ||
    withDatabaseName(requireBaseUri(), getSourceDbName())
  );
}

/** Connection string for the TARGET system's database (Concerto stand-in). */
export function getTargetDbUri(): string {
  return (
    process.env.DEMO_CONCERTO_DB_URL ||
    withDatabaseName(requireBaseUri(), getTargetDbName())
  );
}

export function getSourceDbName(): string {
  return process.env.DEMO_JOBLOGIC_DB_NAME || 'proofsync_demo_joblogic';
}

export function getTargetDbName(): string {
  return process.env.DEMO_CONCERTO_DB_NAME || 'proofsync_demo_concerto';
}

/**
 * Credentials the simulated connectors "log in" with. These are the demo
 * systems' OWN fake logins — they guard nothing real and are seeded into each
 * demo database. They exist to model the session lifecycle (authenticate →
 * session token → expiry → re-authenticate), not to provide security.
 */
export const DEMO_SOURCE_LOGIN = {
  username: 'proofsync.integration@meridian-fm.example',
  password: 'demo-not-a-real-secret',
};

export const DEMO_TARGET_LOGIN = {
  username: 'proofsync.svc@concerto-client.example',
  password: 'demo-not-a-real-secret',
};

/** Simulated session lifetime, so the demo exercises a re-login mid-run. */
export const DEMO_SESSION_TTL_MS = 5 * 60_000;

/**
 * The demo runs inside its own Organisation so it can be reset without touching
 * the seeded product-tour data that /dashboard and /jobs render.
 */
// NOTE: bumped to a fresh org so the ledger starts clean. An earlier concurrency
// bug left orphaned rows under the previous org that Prisma's relation checks
// couldn't delete; a new org name sidesteps that data entirely rather than
// trying to repair it. The old org's rows are harmless and simply unused.
export const DEMO_ORG_NAME = 'Meridian FM — live sync demo (v2)';
export const DEMO_CLIENT_NAME = 'Northgate Retail Estates';
export const DEMO_CONCERTO_TENANT = 'northgate-concerto';
