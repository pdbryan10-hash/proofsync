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
  return Number.isFinite(raw) && raw >= 5 ? raw : 30;
}

/** How many new completed jobs the source system produces per beat (0..max). */
export function getDripPerTick(): number {
  const raw = Number(process.env.DEMO_DRIP_PER_TICK);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2;
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
export const DEMO_ORG_NAME = 'Meridian FM (live sync demo)';
export const DEMO_CLIENT_NAME = 'Northgate Retail Estates';
export const DEMO_CONCERTO_TENANT = 'northgate-concerto';
